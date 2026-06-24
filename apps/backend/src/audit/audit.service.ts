import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
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
  async exportExcel(filters?: AuditFilters): Promise<Buffer> {
    const where = this.buildWhere(filters);

    const registros = await this.prisma.registroAuditoria.findMany({
      where,
      include: {
        usuario: { select: { nombre: true, correo: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
      take: 10_000,
    });

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: 1 },
      select: { razonSocial: true, nombreComercial: true, ruc: true },
    });
    const nombre =
      empresa?.nombreComercial ?? empresa?.razonSocial ?? 'La Cosecha S.A.C.';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Auditoría');

    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 22 },
      { header: 'Usuario', key: 'usuario', width: 28 },
      { header: 'Acción', key: 'accion', width: 14 },
      { header: 'Módulo', key: 'modulo', width: 18 },
      { header: 'Entidad ID', key: 'entidadId', width: 12 },
      { header: 'Detalle', key: 'detalle', width: 45 },
      { header: 'IP', key: 'ip', width: 18 },
    ];

    for (const r of registros) {
      sheet.addRow({
        fecha: r.fechaCreacion.toISOString(),
        usuario: r.usuario?.nombre ?? '',
        accion: r.accion,
        modulo: r.modulo,
        entidadId:
          r.entidadId !== null && r.entidadId !== undefined ? r.entidadId : '',
        detalle: r.detalle ?? '',
        ip: r.ip ?? '',
      });
    }

    // Encabezado branded arriba de la tabla (mismo criterio que los reportes).
    const colCount = sheet.columns.length;
    sheet.spliceRows(
      1,
      0,
      [nombre],
      [empresa?.ruc ? `RUC: ${empresa.ruc}` : ''],
      ['Reporte de Auditoría'],
      [`Período: ${filters?.desde || '—'} a ${filters?.hasta || '—'}`],
      [],
    );
    for (let i = 1; i <= 4; i++) {
      sheet.mergeCells(i, 1, i, colCount);
    }
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(2).font = { size: 10 };
    sheet.getRow(3).font = { bold: true, size: 12 };
    sheet.getRow(4).font = { italic: true, size: 10 };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
