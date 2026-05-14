import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { PrismaService } from '../prisma/prisma.service';

interface DeepHealthResult {
  status: 'ok' | 'error' | 'shutting_down';
  info?: Record<string, { status: string; [key: string]: unknown }>;
  details: Record<string, { status: string; [key: string]: unknown }>;
}

describe('HealthController', () => {
  let controller: HealthController;
  let prismaQueryRaw: jest.Mock;

  beforeEach(async () => {
    prismaQueryRaw = jest.fn();
    const prismaMock = {
      $queryRaw: prismaQueryRaw,
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        PrismaHealthIndicator,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health (liveness)', () => {
    it('returns ok with positive uptime and ISO timestamp', () => {
      const before = Date.now();
      const result = controller.liveness();
      const after = Date.now();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.uptime).toBeLessThan(60 * 60 * 24); // sanity: <1 day
      // ISO timestamp parse-back into the request window.
      const ts = Date.parse(result.timestamp);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('does NOT touch the database', async () => {
      controller.liveness();
      // Give any microtasks a chance to fire (defensive — liveness is sync).
      await Promise.resolve();
      expect(prismaQueryRaw).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready (readiness)', () => {
    it('returns ok with database up when SELECT 1 succeeds', async () => {
      prismaQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = (await controller.readiness()) as DeepHealthResult;

      expect(result.status).toBe('ok');
      expect(result.details['database']?.status).toBe('up');
      expect(prismaQueryRaw).toHaveBeenCalledTimes(1);
    });

    it('reports database latency in the response payload', async () => {
      prismaQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = (await controller.readiness()) as DeepHealthResult;

      const dbDetail = result.details['database'];
      expect(dbDetail).toBeDefined();
      expect(typeof dbDetail?.['latencyMs']).toBe('number');
      expect(dbDetail?.['latencyMs']).toBeGreaterThanOrEqual(0);
    });

    it('throws ServiceUnavailableException (503) when DB ping fails', async () => {
      prismaQueryRaw.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      );

      // Terminus translates HealthCheckError into ServiceUnavailableException
      // which Nest serializes to HTTP 503.
      await expect(controller.readiness()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('exposes failure details on the thrown 503', async () => {
      prismaQueryRaw.mockRejectedValueOnce(new Error('boom'));

      try {
        await controller.readiness();
        fail('Expected readiness to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        const response = (err as ServiceUnavailableException).getResponse() as {
          status: string;
          details: Record<string, { status: string; message?: string }>;
        };
        expect(response.status).toBe('error');
        expect(response.details['database']?.status).toBe('down');
        expect(response.details['database']?.message).toContain('boom');
      }
    });
  });

  describe('GET /health/deep', () => {
    it('includes database, memory_heap, and disk checks when healthy', async () => {
      prismaQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = (await controller.deep()) as DeepHealthResult;

      expect(result.status).toBe('ok');
      expect(result.details['database']?.status).toBe('up');
      expect(result.details['memory_heap']?.status).toBe('up');
      expect(result.details['disk']?.status).toBe('up');
    });

    it('fails with 503 when the DB is down even if memory/disk are fine', async () => {
      prismaQueryRaw.mockRejectedValueOnce(new Error('db unreachable'));

      await expect(controller.deep()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
