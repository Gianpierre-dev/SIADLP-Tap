import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getLoggerToken, PinoLogger } from 'nestjs-pino';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

type LoggerMock = Pick<PinoLogger, 'info' | 'warn' | 'error' | 'debug'> & {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

const buildUsuarioFixture = (
  overrides: Partial<{
    id: number;
    correo: string;
    contrasena: string;
    nombre: string;
    activo: boolean;
    rolId: number;
    permisos: Array<{ modulo: string; accion: string }>;
  }> = {},
) => {
  const base = {
    id: 1,
    correo: 'admin@siadlp.test',
    contrasena: '$2a$12$hashed',
    nombre: 'Admin User',
    activo: true,
    rolId: 1,
    permisos: [
      { modulo: 'pedidos', accion: 'crear' },
      { modulo: 'pedidos', accion: 'ver' },
    ],
    ...overrides,
  };

  return {
    id: base.id,
    correo: base.correo,
    contrasena: base.contrasena,
    nombre: base.nombre,
    activo: base.activo,
    rolId: base.rolId,
    rol: {
      permisos: base.permisos.map((p) => ({ permiso: p })),
    },
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { usuario: { findUnique: jest.Mock; update: jest.Mock } };
  let jwt: { sign: jest.Mock };
  let logger: LoggerMock;

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: getLoggerToken(AuthService.name), useValue: logger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    const validDto: LoginDto = {
      correo: 'admin@siadlp.test',
      contrasena: 'correctPassword123',
    };

    it('devuelve token y usuario con permisos cuando las credenciales son correctas', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      // Act
      const result = await service.login(validDto);

      // Assert
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.usuario).toEqual({
        id: 1,
        correo: 'admin@siadlp.test',
        nombre: 'Admin User',
        permisos: ['pedidos.crear', 'pedidos.ver'],
      });
      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 1,
        correo: 'admin@siadlp.test',
        rolId: 1,
      });
    });

    it('lanza UnauthorizedException cuando el correo no existe', async () => {
      // Arrange
      prisma.usuario.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(validDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(validDto)).rejects.toThrow(
        'Credenciales inválidas',
      );
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException cuando el usuario está inactivo', async () => {
      // Arrange
      const usuarioInactivo = buildUsuarioFixture({ activo: false });
      prisma.usuario.findUnique.mockResolvedValue(usuarioInactivo);

      // Act & Assert
      await expect(service.login(validDto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException cuando la contraseña es incorrecta', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(service.login(validDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(validDto)).rejects.toThrow(
        'Credenciales inválidas',
      );
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('NO revela si el correo existió en el mensaje de error (seguridad)', async () => {
      // Arrange — caso "correo correcto, pass incorrecto"
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValueOnce(usuario);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const errorPasswordWrong = await service
        .login(validDto)
        .catch((e: Error) => e);

      // Arrange — caso "correo no existe"
      prisma.usuario.findUnique.mockResolvedValueOnce(null);
      const errorEmailWrong = await service
        .login(validDto)
        .catch((e: Error) => e);

      // Assert — ambos errores son idénticos (no leak de info)
      expect(errorPasswordWrong.message).toBe(errorEmailWrong.message);
    });
  });

  describe('changePassword', () => {
    const validDto: ChangePasswordDto = {
      contrasenaActual: 'oldPassword123',
      contrasenaNueva: 'newPassword456',
    };

    it('actualiza la contraseña con hash bcrypt cuando la actual es correcta', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('$2a$12$newhashed' as never);
      prisma.usuario.update.mockResolvedValue({});

      // Act
      const result = await service.changePassword(1, validDto);

      // Assert
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('newPassword456', 12);
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { contrasena: '$2a$12$newhashed' },
      });
      expect(result).toEqual({
        message: 'Contraseña actualizada correctamente',
      });
    });

    it('lanza UnauthorizedException cuando el usuario no existe', async () => {
      // Arrange
      prisma.usuario.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.changePassword(999, validDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.changePassword(999, validDto)).rejects.toThrow(
        'Usuario no encontrado',
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException cuando la contraseña actual es incorrecta', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(service.changePassword(1, validDto)).rejects.toThrow(
        'La contraseña actual es incorrecta',
      );
      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('usa cost factor 12 para bcrypt (estándar OWASP 2024)', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('$2a$12$x' as never);
      prisma.usuario.update.mockResolvedValue({});

      // Act
      await service.changePassword(1, validDto);

      // Assert
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
    });
  });

  describe('logging de auditoría', () => {
    const validDto: LoginDto = {
      correo: 'admin@siadlp.test',
      contrasena: 'correctPassword123',
    };

    it('loguea login.success con userId y correo cuando login es exitoso', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      // Act
      await service.login(validDto);

      // Assert — el primer arg es contexto estructurado, segundo es el "event name"
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          correo: 'admin@siadlp.test',
        }),
        'login.success',
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('loguea login.failed con reason="user_not_found" cuando el correo no existe', async () => {
      // Arrange
      prisma.usuario.findUnique.mockResolvedValue(null);

      // Act
      await service.login(validDto).catch(() => undefined);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          correo: 'admin@siadlp.test',
          reason: 'user_not_found',
        }),
        'login.failed',
      );
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('loguea login.failed con reason="invalid_password" cuando la contraseña es incorrecta', async () => {
      // Arrange
      const usuario = buildUsuarioFixture();
      prisma.usuario.findUnique.mockResolvedValue(usuario);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // Act
      await service.login(validDto).catch(() => undefined);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          correo: 'admin@siadlp.test',
          userId: 1,
          reason: 'invalid_password',
        }),
        'login.failed',
      );
    });

    it('NO loguea la contraseña en texto plano en ningún caso (defense in depth)', async () => {
      // Arrange — login fallido por user_not_found
      prisma.usuario.findUnique.mockResolvedValue(null);

      // Act
      await service.login(validDto).catch(() => undefined);

      // Assert — recorrer todas las llamadas y verificar que ninguna contiene la pass.
      // Cast explícito a unknown[][] porque jest.Mock.calls tipa como any[][] y eslint
      // bloquea el spread de any. El contenido lo serializamos con JSON.stringify, que
      // acepta unknown sin problema.
      const allCalls: unknown[][] = [
        ...(logger.info.mock.calls as unknown[][]),
        ...(logger.warn.mock.calls as unknown[][]),
        ...(logger.error.mock.calls as unknown[][]),
      ];

      for (const call of allCalls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain('correctPassword123');
        expect(serialized).not.toContain('contrasena');
      }
    });
  });
});
