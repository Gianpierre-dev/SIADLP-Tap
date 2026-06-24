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
  accion?: string;
  desde?: string;
  hasta?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: CreateAuditLogDto): Promise<void> {
    await this.prisma.registroAuditoria.create({ data });
  }

  // Construye el filtro Prisma compartido entre findAll y exportCsv
  private buildWhere(filters?: AuditFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters?.usuarioId) where.usuarioId = filters.usuarioId;
    if (filters?.modulo) where.modulo = filters.modulo;
    if (filters?.accion) where.accion = filters.accion;
    if (filters?.desde || filters?.hasta) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.desde) fechaFilter.gte = new Date(filters.desde);
      if (filters.hasta) fechaFilter.lte = new Date(filters.hasta);
      where.fechaCreacion = fechaFilter;
    }

    return where;
  }

  async findAll(filters?: AuditFilters, page = 1, pageSize = 20) {
    const where = this.buildWhere(filters);

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

  // Genera un CSV con los mismos filtros que findAll (sin paginar)
  async exportCsv(filters?: AuditFilters): Promise<string> {
    const where = this.buildWhere(filters);

    const registros = await this.prisma.registroAuditoria.findMany({
      where,
      include: {
        usuario: { select: { nombre: true, correo: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    const headers = [
      'Fecha',
      'Usuario',
      'Accion',
      'Modulo',
      'EntidadId',
      'Detalle',
      'IP',
    ];

    const rows = registros.map((r) => [
      r.fechaCreacion.toISOString(),
      r.usuario?.nombre ?? '',
      r.accion,
      r.modulo,
      r.entidadId !== null && r.entidadId !== undefined
        ? String(r.entidadId)
        : '',
      r.detalle ?? '',
      r.ip ?? '',
    ]);

    const lines = [headers, ...rows].map((cols) =>
      cols.map((c) => this.escapeCsv(c)).join(','),
    );

    // BOM para que Excel reconozca UTF-8
    return '﻿' + lines.join('\r\n');
  }

  // Escapa un valor para CSV (comillas, comas, saltos de linea)
  private escapeCsv(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
