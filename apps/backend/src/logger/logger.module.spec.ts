import { Test, TestingModule } from '@nestjs/testing';
import { Logger, PinoLogger } from 'nestjs-pino';

import { LoggerModule } from './logger.module';
import { errSerializer, reqSerializer } from './serializers';

describe('LoggerModule', () => {
  // Cada test cambia NODE_ENV — guardamos el original y restauramos.
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('compila correctamente y expone el Logger de nestjs-pino', async () => {
    process.env['NODE_ENV'] = 'test';

    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.register()],
    }).compile();

    const logger = module.get(Logger);
    expect(logger).toBeDefined();
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');

    await module.close();
  });

  it('expone PinoLogger inyectable para los services', async () => {
    process.env['NODE_ENV'] = 'test';

    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.register()],
    }).compile();

    // PinoLogger es un provider transient-scoped (cada quien recibe su instancia
    // con el contexto de su clase), por eso `resolve()` y no `get()`.
    const pinoLogger = await module.resolve(PinoLogger);
    expect(pinoLogger).toBeDefined();
    expect(typeof pinoLogger.info).toBe('function');
    expect(typeof pinoLogger.warn).toBe('function');

    await module.close();
  });
});

describe('serializers', () => {
  describe('reqSerializer', () => {
    it('redacta el header Authorization', () => {
      const result = reqSerializer({
        id: 'req-1',
        raw: {
          method: 'POST',
          url: '/api/auth/login',
          headers: {
            authorization: 'Bearer secret-token-do-not-leak',
            'content-type': 'application/json',
          },
        },
      } as never);

      const headers = result['headers'] as Record<string, string>;
      expect(headers['authorization']).toBe('[REDACTED]');
      expect(headers['content-type']).toBe('application/json');
    });

    it('redacta Cookie y Set-Cookie', () => {
      const result = reqSerializer({
        id: 'req-2',
        raw: {
          method: 'GET',
          url: '/',
          headers: {
            cookie: 'sessionId=abc123',
            'set-cookie': 'foo=bar',
            host: 'localhost',
          },
        },
      } as never);

      const headers = result['headers'] as Record<string, string>;
      expect(headers['cookie']).toBe('[REDACTED]');
      expect(headers['set-cookie']).toBe('[REDACTED]');
      expect(headers['host']).toBe('localhost');
    });

    it('redacta x-api-key (case-insensitive)', () => {
      const result = reqSerializer({
        id: 'req-3',
        raw: {
          method: 'GET',
          url: '/',
          headers: { 'X-Api-Key': 'super-secret' },
        },
      } as never);

      const headers = result['headers'] as Record<string, string>;
      expect(headers['X-Api-Key']).toBe('[REDACTED]');
    });

    it('captura el request id', () => {
      const result = reqSerializer({
        id: 'req-correlation-id',
        raw: { method: 'GET', url: '/', headers: {} },
      } as never);

      expect(result['id']).toBe('req-correlation-id');
    });
  });

  describe('errSerializer', () => {
    it('captura type, message y stack lines', () => {
      const err = new Error('boom');
      const result = errSerializer(err);

      expect(result['type']).toBe('Error');
      expect(result['message']).toBe('boom');
      expect(Array.isArray(result['stack'])).toBe(true);
      expect((result['stack'] as string[]).length).toBeGreaterThan(0);
    });

    it('captura el code de errores con código (e.g. Prisma)', () => {
      const err = Object.assign(new Error('unique violation'), {
        code: 'P2002',
      });
      const result = errSerializer(err);

      expect(result['code']).toBe('P2002');
    });

    it('captura statusCode de HttpException', () => {
      const err = Object.assign(new Error('not found'), { statusCode: 404 });
      const result = errSerializer(err);

      expect(result['statusCode']).toBe(404);
    });

    it('captura cause como sub-error serializado', () => {
      const cause = new Error('underlying connection lost');
      const err = new Error('request failed');
      (err as Error & { cause: Error }).cause = cause;

      const result = errSerializer(err);

      expect(result['cause']).toEqual(
        expect.objectContaining({
          type: 'Error',
          message: 'underlying connection lost',
        }),
      );
    });
  });
});
