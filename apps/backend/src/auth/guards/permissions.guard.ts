import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 5 * 60 * 1_000;

interface PermissionCacheEntry {
  permissions: string[];
  expiresAt: number;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly cache = new Map<number, PermissionCacheEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { rolId: number } }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('No autenticado');

    const userPermissions = await this.getPermissionsForRole(user.rolId);

    const hasPermission = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException('No tiene permisos para esta acción');
    }

    return true;
  }

  private async getPermissionsForRole(rolId: number): Promise<string[]> {
    const cached = this.cache.get(rolId);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const rolPermisos = await this.prisma.rolPermiso.findMany({
      where: { rolId },
      include: { permiso: true },
    });

    const permissions = rolPermisos.map(
      (rp) => `${rp.permiso.modulo}.${rp.permiso.accion}`,
    );

    this.cache.set(rolId, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return permissions;
  }

  invalidateRole(rolId: number): void {
    this.cache.delete(rolId);
  }
}
