import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'crear',
  PATCH: 'editar',
  DELETE: 'eliminar',
};

const PATH_MODULE_MAP: Record<string, string> = {
  auth: 'autenticacion',
  users: 'usuarios',
  roles: 'roles',
  'catalogs/clients': 'clientes',
  'catalogs/suppliers': 'proveedores',
  'catalogs/products': 'productos',
  'catalogs/routes': 'rutas',
  'catalogs/vehicles': 'vehiculos',
  'catalogs/drivers': 'choferes',
  orders: 'pedidos',
  purchases: 'compras',
  production: 'produccion',
  inventory: 'inventario',
  dispatch: 'despacho',
  audit: 'auditoria',
};

function resolveModulo(path: string): string {
  // Strip leading /api/ or /
  const normalized = path.replace(/^\/api\//, '').replace(/^\//, '');

  // Try longest match first (e.g. catalogs/clients before catalogs)
  const sortedKeys = Object.keys(PATH_MODULE_MAP).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of sortedKeys) {
    if (normalized.startsWith(key)) {
      return PATH_MODULE_MAP[key];
    }
  }

  // Fallback: first path segment
  return normalized.split('/')[0] ?? 'desconocido';
}

interface AuthenticatedUser {
  id: number;
  correo: string;
  rolId: number;
}

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const method = req.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const user = req.user;

    // If no authenticated user (e.g. public endpoints), skip logging
    if (!user) {
      return next.handle();
    }

    const accion = METHOD_ACTION_MAP[method] ?? method.toLowerCase();
    const modulo = resolveModulo(req.path);
    const ip = req.ip ?? req.socket?.remoteAddress;

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget: do not await, do not block the response
          this.auditService
            .log({
              usuarioId: user.id,
              accion,
              modulo,
              ip,
            })
            .catch(() => {
              // Silently swallow errors — audit must never break the app
            });
        },
        error: () => {
          // Do not log failed requests
        },
      }),
    );
  }
}
