import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

import { Public } from '../auth/decorators/public.decorator';
import { PrismaHealthIndicator } from './indicators/prisma.health';

/**
 * Memory threshold (bytes) for the deep health check.
 *
 * 300 MiB is comfortable for a NestJS API with Prisma's PG pool; processes
 * trending above this on idle are leaking. Tune via `HEALTH_HEAP_THRESHOLD_MB`
 * if a particular deploy needs more room.
 */
const DEFAULT_HEAP_THRESHOLD_MB = 300;

/**
 * Disk usage threshold (0..1) for the deep health check.
 *
 * Railway disks are ephemeral but fillable (uploads/, logs). 0.9 = alert at
 * 90% used so the runbook has time to react before writes start failing.
 */
const DISK_THRESHOLD_PERCENT = 0.9;

/**
 * Resolve the disk path used for the storage check. Windows has drive letters,
 * POSIX uses `/`. We never want a deep-check failure due to a hardcoded path.
 */
function resolveDiskPath(): string {
  return process.platform === 'win32' ? 'C:\\' : '/';
}

function resolveHeapThresholdBytes(): number {
  const raw = process.env['HEALTH_HEAP_THRESHOLD_MB'];
  const mb = raw ? Number.parseInt(raw, 10) : DEFAULT_HEAP_THRESHOLD_MB;
  const safe = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_HEAP_THRESHOLD_MB;
  return safe * 1024 * 1024;
}

/**
 * Health endpoints. All routes are `@Public()` so they bypass JWT — probes
 * from Railway / load balancers / Kubernetes do not carry auth tokens and
 * locking these behind auth defeats the purpose of a liveness check.
 *
 * Layout:
 *  - GET /api/health        → liveness  (process is up, no deps)
 *  - GET /api/health/ready  → readiness (can serve traffic: DB up)
 *  - GET /api/health/deep   → diagnostic (DB + memory + disk) — for ops
 *
 * The global API prefix `api` is set in `main.ts` so the effective paths
 * include `/api/`.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly prismaIndicator: PrismaHealthIndicator,
  ) {}

  /**
   * Liveness probe. Cheap, dependency-free. Returns `200` as long as the
   * Node process can answer HTTP. If this fails, the orchestrator should
   * restart the container.
   *
   * Target latency: < 50ms.
   */
  @Public()
  @Get()
  liveness(): {
    status: 'ok';
    timestamp: string;
    uptime: number;
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness probe. Returns `200` only when the app can actually serve
   * traffic — i.e. the DB pool can answer a `SELECT 1`. On failure terminus
   * surfaces a `503 Service Unavailable` so the load balancer drains the pod.
   *
   * Target latency: < 500ms (DB ping should be fast or we are already broken).
   */
  @Public()
  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', 5_000),
    ]);
  }

  /**
   * Deep health check. Same as readiness PLUS process resources. Useful for
   * dashboards, on-call diagnostics, and pre-deploy smoke tests. Do NOT
   * point Kubernetes/Railway probes at this — the disk check hits the OS
   * and adds latency we do not want on the critical probing path.
   *
   * Target latency: < 2s.
   */
  @Public()
  @Get('deep')
  @HealthCheck()
  deep(): Promise<HealthCheckResult> {
    const heapThreshold = resolveHeapThresholdBytes();
    const diskPath = resolveDiskPath();

    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', 5_000),
      () => this.memory.checkHeap('memory_heap', heapThreshold),
      () =>
        this.disk.checkStorage('disk', {
          path: diskPath,
          thresholdPercent: DISK_THRESHOLD_PERCENT,
        }),
    ]);
  }
}
