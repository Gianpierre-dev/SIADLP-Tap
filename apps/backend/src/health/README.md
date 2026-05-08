# Health Module

Production-grade health endpoints built on top of [`@nestjs/terminus`].

The endpoints are **public** (`@Public()`), so probes from Railway, load
balancers, and Kubernetes do not need a JWT. Auth-locking these defeats the
purpose of an external health check.

All routes are mounted under the global `api` prefix configured in
`main.ts`, so the effective paths are `/api/health`, `/api/health/ready`,
and `/api/health/deep`.

## Endpoints

| Endpoint | Purpose | Checks | Target latency | HTTP on failure |
|----------|---------|--------|----------------|-----------------|
| `GET /api/health` | Liveness — is the process up? | none | < 50 ms | n/a (only fails if Node itself dies) |
| `GET /api/health/ready` | Readiness — can it serve traffic? | DB ping (`SELECT 1`) | < 500 ms | `503 Service Unavailable` |
| `GET /api/health/deep` | Diagnostic deep-check | DB + heap memory + disk | < 2 s | `503 Service Unavailable` |

### `GET /api/health` — Liveness

No dependencies. Returns immediately if the Node process is responsive.

If this fails, the orchestrator should **restart** the container — the
process is wedged.

#### Response (200 OK)

```json
{
  "status": "ok",
  "timestamp": "2026-05-07T18:30:12.041Z",
  "uptime": 1342.18
}
```

`uptime` is in seconds since the Node process started.

### `GET /api/health/ready` — Readiness

Runs `SELECT 1` against PostgreSQL through the Prisma pool with a 5-second
hard timeout. Returns `200` only when the DB is reachable.

If this fails, the orchestrator should **stop sending traffic** but NOT
restart — the process is fine, the dependency is not.

#### Success (200 OK)

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up", "latencyMs": 8 }
  },
  "error": {},
  "details": {
    "database": { "status": "up", "latencyMs": 8 }
  }
}
```

#### Failure (503 Service Unavailable)

```json
{
  "status": "error",
  "info": {},
  "error": {
    "database": {
      "status": "down",
      "latencyMs": 5012,
      "message": "database ping timed out after 5000ms"
    }
  },
  "details": {
    "database": {
      "status": "down",
      "latencyMs": 5012,
      "message": "database ping timed out after 5000ms"
    }
  }
}
```

### `GET /api/health/deep` — Deep diagnostic

Same as `/ready` plus:

- **Heap usage** must be below `HEALTH_HEAP_THRESHOLD_MB` (default `300`).
- **Disk usage** on the OS root (`/` on POSIX, `C:\` on Windows) must be
  below 90 %.

Use this for dashboards, on-call diagnostics, and pre-deploy smoke tests.
**Do NOT** point Kubernetes / Railway probes at it — disk inspection adds
latency we do not want on the critical probe path.

#### Response (200 OK)

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up", "latencyMs": 7 },
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up", "latencyMs": 7 },
    "memory_heap": { "status": "up" },
    "disk": { "status": "up" }
  }
}
```

## Probe configuration

### Railway

In `railway.json` (or the service settings UI):

```json
{
  "deploy": {
    "healthcheckPath": "/api/health/ready",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

Why `/health/ready` and not `/health`? Railway only has **one** health
slot. We want the platform to drain traffic when the DB is unreachable, so
readiness is the correct choice. Liveness on its own would mark a
DB-disconnected pod as healthy and keep routing traffic to it.

### Kubernetes

Liveness restarts a wedged pod; readiness drains traffic from a pod that
cannot serve. They MUST be different endpoints — pointing both at the same
URL is a common antipattern that turns transient DB blips into restart
loops.

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 2
  successThreshold: 1
```

`initialDelaySeconds` on liveness is intentionally larger (10 s vs 5 s) to
give the app time to warm up — restarting during startup creates a crash
loop.

`failureThreshold: 2` on readiness means we need two consecutive failures
before draining; a single 5-second DB blip will not flap traffic.

## Configuration

| Env var | Default | Effect |
|---------|---------|--------|
| `HEALTH_HEAP_THRESHOLD_MB` | `300` | Max heap (in MiB) before `/deep` reports `down`. |

The DB ping timeout (5 s) and disk threshold (90 %) are constants in
`health.controller.ts` and `indicators/prisma.health.ts`. Tune them by
editing the constants — they are SLO-level decisions and should be
reviewed in code review, not via env vars.

## Observability

Probes are anonymous: there are no audit log entries, no JWT, no user
context. They DO go through the global `ThrottlerGuard`, which is fine —
healthy probes are infrequent (every 10–30 s) and well below any limit.

Each readiness/deep response carries `latencyMs` for the DB ping. Scrape
this with `curl` from a sidecar or expose it through Prometheus to graph
DB round-trip-time directly from the probe path.
