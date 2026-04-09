import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
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
  const normalized = path.replace(/^\/api\//, '').replace(/^\//, '');

  const sortedKeys = Object.keys(PATH_MODULE_MAP).sort(
    (a, b) => b.length - a.length,
  );

  for (const key of sortedKeys) {
    if (normalized.startsWith(key)) {
      return PATH_MODULE_MAP[key];
    }
  }

  return normalized.split('/')[0] ?? 'desconocido';
}

function resolveEntidadId(path: string): number | undefined {
  const parts = path.replace(/^\/api\//, '').split('/');
  // Try to find a numeric ID in the path segments
  for (let i = parts.length - 1; i >= 0; i--) {
    const num = Number(parts[i]);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return undefined;
}

interface AuthenticatedUser {
  id: number;
  correo: string;
  rolId: number;
}

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const method = req.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const user = req.user;

    if (!user) {
      return next.handle();
    }

    const accion = METHOD_ACTION_MAP[method] ?? method.toLowerCase();
    const modulo = resolveModulo(req.path);
    const entidadId = resolveEntidadId(req.path);
    const ip = req.ip ?? req.socket?.remoteAddress;

    return next.handle().pipe(
      tap({
        next: () => {
          this.auditService
            .log({
              usuarioId: user.id,
              accion,
              modulo,
              entidadId,
              detalle: `${method} ${req.path}`,
              ip,
            })
            .catch((err: Error) => {
              this.logger.error(`Failed to write audit log: ${err.message}`);
            });
        },
      }),
    );
  }
}
