import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type PrismaMock = {
  rolPermiso: { findMany: jest.Mock };
};

type ReflectorMock = {
  getAllAndOverride: jest.Mock;
};

interface RequestUser {
  rolId: number;
}

const buildExecutionContext = (
  user: RequestUser | undefined,
): ExecutionContext => {
  const handler = (): void => {};
  class FakeClass {}
  const httpReturn = {
    getRequest: <T>() => ({ user }) as T,
  };
  return {
    getHandler: () => handler,
    getClass: () => FakeClass,
    switchToHttp: () => httpReturn,
  } as unknown as ExecutionContext;
};

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: ReflectorMock;
  let prisma: PrismaMock;

  beforeEach(async () => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    prisma = {
      rolPermiso: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  it('permite acceso cuando NO hay metadata @RequirePermissions (ruta sin restricción)', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return undefined;
      return undefined;
    });
    const ctx = buildExecutionContext({ rolId: 1 });

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect(prisma.rolPermiso.findMany).not.toHaveBeenCalled();
  });

  it('permite acceso cuando @Public() está presente, sin importar permisos requeridos', async () => {
    // Arrange — handler marcado @Public() debe cortocircuitar antes de mirar permisos
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      if (key === PERMISSIONS_KEY) return ['pedidos.crear'];
      return undefined;
    });
    const ctx = buildExecutionContext(undefined);

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect(prisma.rolPermiso.findMany).not.toHaveBeenCalled();
  });

  it('permite acceso cuando el usuario tiene TODOS los permisos requeridos', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['pedidos.crear', 'pedidos.ver'];
      return undefined;
    });
    prisma.rolPermiso.findMany.mockResolvedValue([
      { permiso: { modulo: 'pedidos', accion: 'crear' } },
      { permiso: { modulo: 'pedidos', accion: 'ver' } },
      { permiso: { modulo: 'pedidos', accion: 'eliminar' } },
    ]);
    const ctx = buildExecutionContext({ rolId: 7 });

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect(prisma.rolPermiso.findMany).toHaveBeenCalledWith({
      where: { rolId: 7 },
      include: { permiso: true },
    });
  });

  it('lanza ForbiddenException cuando al usuario le falta UN permiso requerido (AND lógico)', async () => {
    // Arrange — usuario tiene "crear" pero NO "aprobar"
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['pedidos.crear', 'pedidos.aprobar'];
      return undefined;
    });
    prisma.rolPermiso.findMany.mockResolvedValue([
      { permiso: { modulo: 'pedidos', accion: 'crear' } },
    ]);
    const ctx = buildExecutionContext({ rolId: 3 });

    // Act & Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/permisos/i);
  });

  it('lanza ForbiddenException cuando al usuario le faltan TODOS los permisos', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['admin.todo'];
      return undefined;
    });
    prisma.rolPermiso.findMany.mockResolvedValue([
      { permiso: { modulo: 'pedidos', accion: 'ver' } },
    ]);
    const ctx = buildExecutionContext({ rolId: 9 });

    // Act & Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException cuando request.user no existe (no hay JWT decoded)', async () => {
    // Arrange — sin user en el request (escenario: JWT inválido o ausente que llegó al guard)
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['pedidos.ver'];
      return undefined;
    });
    const ctx = buildExecutionContext(undefined);

    // Act & Assert
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/autenticado/i);
    expect(prisma.rolPermiso.findMany).not.toHaveBeenCalled();
  });

  it('permite acceso si la lista de permisos requeridos está vacía', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return [];
      return undefined;
    });
    const ctx = buildExecutionContext({ rolId: 1 });

    // Act
    const result = await guard.canActivate(ctx);

    // Assert
    expect(result).toBe(true);
    expect(prisma.rolPermiso.findMany).not.toHaveBeenCalled();
  });

  it('cachea permisos por rol — segunda llamada no consulta la base de datos', async () => {
    // Arrange — TTL del cache es 5 min, dentro de un mismo test no expira
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['pedidos.ver'];
      return undefined;
    });
    prisma.rolPermiso.findMany.mockResolvedValue([
      { permiso: { modulo: 'pedidos', accion: 'ver' } },
    ]);
    const ctx = buildExecutionContext({ rolId: 11 });

    // Act
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);

    // Assert
    expect(prisma.rolPermiso.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidateRole limpia el cache y obliga a recargar los permisos', async () => {
    // Arrange
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return undefined;
      if (key === PERMISSIONS_KEY) return ['pedidos.ver'];
      return undefined;
    });
    prisma.rolPermiso.findMany.mockResolvedValue([
      { permiso: { modulo: 'pedidos', accion: 'ver' } },
    ]);
    const ctx = buildExecutionContext({ rolId: 22 });

    // Act
    await guard.canActivate(ctx);
    guard.invalidateRole(22);
    await guard.canActivate(ctx);

    // Assert
    expect(prisma.rolPermiso.findMany).toHaveBeenCalledTimes(2);
  });
});
