import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { LoggerModule } from '../src/logger/logger.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/e2e-app';

const TEST_JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';

interface LoginResponseBody {
  accessToken: string;
  usuario: {
    id: number;
    correo: string;
    nombre: string;
    permisos: string[];
  };
}

interface ErrorResponseBody {
  message: string | string[];
  statusCode: number;
}

interface UsuarioRecord {
  id: number;
  correo: string;
  contrasena: string;
  nombre: string;
  activo: boolean;
  rolId: number;
  rol: {
    permisos: Array<{ permiso: { modulo: string; accion: string } }>;
  };
}

describe('Auth E2E (POST /api/auth/login)', () => {
  let app: INestApplication;
  let usuariosMock: Map<string, UsuarioRecord>;

  beforeAll(async () => {
    usuariosMock = new Map();

    const prismaMock = {
      usuario: {
        findUnique: jest.fn(
          ({ where }: { where: { correo?: string; id?: number } }) => {
            if (where.correo)
              return Promise.resolve(usuariosMock.get(where.correo) ?? null);
            if (where.id) {
              for (const u of usuariosMock.values()) {
                if (u.id === where.id) return Promise.resolve(u);
              }
            }
            return Promise.resolve(null);
          },
        ),
        update: jest.fn(),
      },
    };

    app = await createTestApp({
      imports: [
        // LoggerModule.register() provee PinoLogger (NODE_ENV=test → silent).
        // Debe ser una llamada en runtime — ver comentario en logger/logger.module.ts.
        LoggerModule.register(),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    });

    // Seed un usuario de prueba con password hasheado
    const passwordHash = await bcrypt.hash('correctPassword123', 12);
    usuariosMock.set('admin@siadlp.test', {
      id: 1,
      correo: 'admin@siadlp.test',
      contrasena: passwordHash,
      nombre: 'Admin',
      activo: true,
      rolId: 1,
      rol: {
        permisos: [
          { permiso: { modulo: 'pedidos', accion: 'crear' } },
          { permiso: { modulo: 'pedidos', accion: 'ver' } },
        ],
      },
    });

    const inactivePassword = await bcrypt.hash('inactive123', 12);
    usuariosMock.set('inactivo@siadlp.test', {
      id: 2,
      correo: 'inactivo@siadlp.test',
      contrasena: inactivePassword,
      nombre: 'Inactivo',
      activo: false,
      rolId: 1,
      rol: { permisos: [] },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('happy path', () => {
    it('POST /api/auth/login con credenciales correctas → 201 + token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          correo: 'admin@siadlp.test',
          contrasena: 'correctPassword123',
        });

      expect(response.status).toBe(201);
      const body = response.body as LoginResponseBody;
      expect(body).toHaveProperty('accessToken');
      expect(body.accessToken).toMatch(/^eyJ/); // JWT empieza con eyJ
      expect(body.usuario).toEqual({
        id: 1,
        correo: 'admin@siadlp.test',
        nombre: 'Admin',
        permisos: ['pedidos.crear', 'pedidos.ver'],
      });
    });

    it('el JWT devuelto es válido y contiene el payload correcto', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          correo: 'admin@siadlp.test',
          contrasena: 'correctPassword123',
        });

      const jwtService = new JwtService({ secret: TEST_JWT_SECRET });
      const body = response.body as LoginResponseBody;
      const decoded = jwtService.verify<{
        sub: number;
        correo: string;
        rolId: number;
      }>(body.accessToken);

      expect(decoded.sub).toBe(1);
      expect(decoded.correo).toBe('admin@siadlp.test');
      expect(decoded.rolId).toBe(1);
    });
  });

  describe('error paths', () => {
    it('POST /api/auth/login con email inexistente → 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          correo: 'noexiste@siadlp.test',
          contrasena: 'cualquierCosa1',
        });

      expect(response.status).toBe(401);
      const body = response.body as ErrorResponseBody;
      expect(body.message).toBe('Credenciales inválidas');
    });

    it('POST /api/auth/login con usuario inactivo → 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          correo: 'inactivo@siadlp.test',
          contrasena: 'inactive123',
        });

      expect(response.status).toBe(401);
    });

    it('POST /api/auth/login con password incorrecto → 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          correo: 'admin@siadlp.test',
          contrasena: 'passwordIncorrecto1',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('validation pipe (DTO)', () => {
    it('rechaza payload sin correo → 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ contrasena: 'password123' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponseBody;
      expect(body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/correo/i)]),
      );
    });

    it('rechaza payload sin contrasena → 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo: 'admin@siadlp.test' });

      expect(response.status).toBe(400);
    });

    it('rechaza correo con formato inválido → 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo: 'no-es-email', contrasena: 'password123' });

      expect(response.status).toBe(400);
    });

    it('rechaza contraseña corta (<8 chars) → 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ correo: 'admin@siadlp.test', contrasena: '1234' });

      expect(response.status).toBe(400);
    });

    it('rechaza propiedades extras (forbidNonWhitelisted) → 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          correo: 'admin@siadlp.test',
          contrasena: 'password123',
          isAdmin: true, // ← propiedad extra que NO está en el DTO
        });

      expect(response.status).toBe(400);
    });
  });
});

describe('JwtAuthGuard E2E (rutas protegidas)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prismaMock = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    app = await createTestApp({
      imports: [
        LoggerModule.register(),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: prismaMock },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('PATCH /api/auth/change-password sin Authorization header → 401', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/auth/change-password')
      .send({
        contrasenaActual: 'oldPass123',
        contrasenaNueva: 'newPass456',
      });

    expect(response.status).toBe(401);
  });

  it('PATCH /api/auth/change-password con Bearer token inválido → 401', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/auth/change-password')
      .set('Authorization', 'Bearer token-invalido')
      .send({
        contrasenaActual: 'oldPass123',
        contrasenaNueva: 'newPass456',
      });

    expect(response.status).toBe(401);
  });
});
