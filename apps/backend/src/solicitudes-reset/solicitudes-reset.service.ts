import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CrearSolicitudResetDto } from './dto/crear-solicitud.dto';

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

const SOLICITUD_INCLUDE = {
  usuario: {
    select: { id: true, correo: true, nombre: true },
  },
  aprobador: {
    select: { id: true, correo: true, nombre: true },
  },
} as const;

@Injectable()
export class SolicitudesResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  async crear(dto: CrearSolicitudResetDto): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
      select: { id: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
      return;
    }

    const pendiente = await this.prisma.solicitudResetContrasena.findFirst({
      where: { usuarioId: usuario.id, estado: 'PENDIENTE' },
      select: { id: true },
    });

    if (pendiente) {
      return;
    }

    const solicitud = await this.prisma.solicitudResetContrasena.create({
      data: {
        usuarioId: usuario.id,
        motivo: dto.motivo ?? null,
      },
    });

    await this.audit.log({
      usuarioId: usuario.id,
      accion: 'crear_solicitud_reset',
      modulo: 'solicitudes_reset',
      entidadId: solicitud.id,
      detalle: `Solicitud de reset creada para ${dto.correo}`,
    });
  }

  async listar(estado?: EstadoSolicitud) {
    return this.prisma.solicitudResetContrasena.findMany({
      where: estado ? { estado } : undefined,
      include: SOLICITUD_INCLUDE,
      orderBy: [{ estado: 'asc' }, { fechaCreacion: 'desc' }],
    });
  }

  async contarPendientes(): Promise<number> {
    return this.prisma.solicitudResetContrasena.count({
      where: { estado: 'PENDIENTE' },
    });
  }

  async aprobar(
    id: number,
    aprobadorId: number,
  ): Promise<{ contrasenaTemporal: string }> {
    const solicitud = await this.prisma.solicitudResetContrasena.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, activo: true } } },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (solicitud.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        'Solo se pueden aprobar solicitudes en estado PENDIENTE',
      );
    }

    if (!solicitud.usuario.activo) {
      throw new BadRequestException('El usuario solicitante está inactivo');
    }

    const { contrasenaTemporal } = await this.users.resetPassword(
      solicitud.usuario.id,
      aprobadorId,
    );

    await this.prisma.solicitudResetContrasena.update({
      where: { id },
      data: {
        estado: 'APROBADA',
        aprobadorId,
        fechaProcesamiento: new Date(),
      },
    });

    await this.audit.log({
      usuarioId: aprobadorId,
      accion: 'aprobar_solicitud_reset',
      modulo: 'solicitudes_reset',
      entidadId: id,
      detalle: `Solicitud aprobada para usuario ${solicitud.usuario.id}`,
    });

    return { contrasenaTemporal };
  }

  async rechazar(
    id: number,
    aprobadorId: number,
    motivoRechazo: string,
  ): Promise<void> {
    const solicitud = await this.prisma.solicitudResetContrasena.findUnique({
      where: { id },
      select: { id: true, estado: true, usuarioId: true },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (solicitud.estado !== 'PENDIENTE') {
      throw new BadRequestException(
        'Solo se pueden rechazar solicitudes en estado PENDIENTE',
      );
    }

    await this.prisma.solicitudResetContrasena.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        aprobadorId,
        motivoRechazo,
        fechaProcesamiento: new Date(),
      },
    });

    await this.audit.log({
      usuarioId: aprobadorId,
      accion: 'rechazar_solicitud_reset',
      modulo: 'solicitudes_reset',
      entidadId: id,
      detalle: `Solicitud rechazada: ${motivoRechazo}`,
    });
  }
}
