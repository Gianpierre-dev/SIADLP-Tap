import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateAuditLogDto {
  usuarioId: number;
  accion: string;
  modulo: string;
  entidadId?: number;
  detalle?: string;
  ip?: string;
}

interface AuditFilters {
  usuarioId?: number;
  modulo?: string;
  desde?: string;
  hasta?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: CreateAuditLogDto): Promise<void> {
    await this.prisma.registroAuditoria.create({ data });
  }

  async findAll(filters?: AuditFilters, page = 1, pageSize = 20) {
    const where: Record<string, unknown> = {};

    if (filters?.usuarioId) where.usuarioId = filters.usuarioId;
    if (filters?.modulo) where.modulo = filters.modulo;
    if (filters?.desde || filters?.hasta) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.desde) fechaFilter.gte = new Date(filters.desde);
      if (filters.hasta) fechaFilter.lte = new Date(filters.hasta);
      where.fechaCreacion = fechaFilter;
    }

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.registroAuditoria.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre: true, correo: true } },
        },
        orderBy: { fechaCreacion: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.registroAuditoria.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }
}
