import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Default timeout (ms) for the database ping. If the query does not complete
 * within this window the indicator is reported as `down`.
 *
 * 5s is generous for a `SELECT 1`. Anything slower means the pool/network is
 * already broken and we should fail readiness rather than block the probe.
 */
const DEFAULT_PRISMA_PING_TIMEOUT_MS = 5_000;

/**
 * Custom Terminus health indicator that pings PostgreSQL through Prisma.
 *
 * Why a custom indicator instead of `PrismaHealthIndicator` from terminus?
 *  - We want a hard timeout (terminus' built-in does not race against a clock).
 *  - We want to surface the latency of the ping in the response payload so
 *    Grafana / Railway can plot DB RTT directly from the readiness endpoint.
 *  - We control the SQL: `SELECT 1` is the cheapest possible round-trip.
 *
 * NOTE: `HealthIndicator` and `HealthCheckError` are marked deprecated in
 * @nestjs/terminus v11 in favour of `HealthIndicatorService`. They are still
 * fully supported until v12 and the deprecated API is what the assignment
 * requested explicitly. When migrating to v12, swap to `HealthIndicatorService`.
 */
@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Run `SELECT 1` against the database and return an `up`/`down` result.
   *
   * @param key Result key (e.g. `database`).
   * @param timeoutMs Hard timeout for the query. Defaults to 5s.
   * @throws HealthCheckError when the query fails or times out.
   */
  async pingCheck(
    key: string,
    timeoutMs: number = DEFAULT_PRISMA_PING_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult> {
    const start = Date.now();

    try {
      await this.runWithTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        timeoutMs,
        key,
      );
      const latencyMs = Date.now() - start;
      return this.getStatus(key, true, { latencyMs });
    } catch (error) {
      const latencyMs = Date.now() - start;
      const message =
        error instanceof Error ? error.message : 'Database ping failed';
      const result = this.getStatus(key, false, {
        latencyMs,
        message,
      });
      throw new HealthCheckError(`${key} check failed`, result);
    }
  }

  /**
   * Race a promise against a timer. The original promise is not cancellable
   * (Prisma queries are not abortable through a public API), so on timeout we
   * resolve the indicator with `down` while the underlying query continues in
   * the background — the connection pool will reclaim it once it finishes.
   */
  private runWithTimeout<T>(
    promise: PromiseLike<T>,
    timeoutMs: number,
    key: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${key} ping timed out after ${String(timeoutMs)}ms`));
      }, timeoutMs);

      Promise.resolve(promise).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }
}
