import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryStatus, OrderStatus } from '@siadlp/shared';

export interface DashboardData {
  pedidos: {
    total: number;
    porEstado: Record<string, number>;
  };
  despacho: {
    hojasDelDia: number;
    entregasCompletadas: number;
    entregasPendientes: number;
    entregasConNovedad: number;
  };
  recursos: {
    clientesActivos: number;
    productosActivos: number;
    rutasActivas: number;
    vehiculosActivos: number;
    choferesActivos: number;
  };
  pendientes: {
    porConfirmar: number;
    porDespachar: number;
    choferesPorRevalidar: number;
  };
  alertasChoferes: Array<{
    nombre: string;
    fechaRevalidacion: string;
    dias: number;
  }>;
  tendencia: Array<{ fecha: string; total: number }>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(fecha: string): Promise<DashboardData> {
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    // 7-day trend window: today and the previous 6 days
    const desde7d = new Date(day);
    desde7d.setDate(desde7d.getDate() - 6);

    // Driver licence revalidation alert window: next 30 days
    const limiteRevalidacion = new Date(day);
    limiteRevalidacion.setDate(limiteRevalidacion.getDate() + 30);

    // Run all independent queries in parallel
    const [
      pedidosGrouped,
      hojasDelDia,
      entregasDelDia,
      clientesActivos,
      productosActivos,
      rutasActivas,
      vehiculosActivos,
      choferesActivos,
      porConfirmar,
      porDespachar,
      choferesPorRevalidar,
      pedidosRecientes,
      choferesAlerta,
    ] = await Promise.all([
      this.prisma.pedido.groupBy({
        by: ['estado'],
        where: { fechaCreacion: { gte: day, lt: nextDay } },
        _count: { id: true },
      }),
      this.prisma.hojaCarga.count({
        where: { fecha: { gte: day, lt: nextDay } },
      }),
      this.prisma.entrega.groupBy({
        by: ['estado'],
        where: {
          pedido: {
            hojaCarga: { fecha: { gte: day, lt: nextDay } },
          },
        },
        _count: { id: true },
      }),
      this.prisma.cliente.count({ where: { activo: true } }),
      this.prisma.producto.count({ where: { activo: true } }),
      this.prisma.ruta.count({ where: { activo: true } }),
      this.prisma.vehiculo.count({ where: { activo: true } }),
      this.prisma.chofer.count({ where: { activo: true } }),
      this.prisma.pedido.count({ where: { estado: OrderStatus.REGISTERED } }),
      this.prisma.pedido.count({ where: { estado: OrderStatus.CONFIRMED } }),
      this.prisma.chofer.count({
        where: {
          activo: true,
          fechaRevalidacion: { lte: limiteRevalidacion },
        },
      }),
      this.prisma.pedido.findMany({
        where: { fechaCreacion: { gte: desde7d, lt: nextDay } },
        select: { fechaCreacion: true },
      }),
      this.prisma.chofer.findMany({
        where: {
          activo: true,
          fechaRevalidacion: { lte: limiteRevalidacion },
        },
        select: { nombre: true, apellido: true, fechaRevalidacion: true },
        orderBy: { fechaRevalidacion: 'asc' },
        take: 5,
      }),
    ]);

    // Process pedidos (today)
    const porEstado: Record<string, number> = {};
    let totalPedidos = 0;
    for (const group of pedidosGrouped) {
      porEstado[group.estado] = group._count.id;
      totalPedidos += group._count.id;
    }

    // Process entregas (today)
    let entregasCompletadas = 0;
    let entregasPendientes = 0;
    let entregasConNovedad = 0;

    for (const group of entregasDelDia) {
      if (group.estado === DeliveryStatus.ENTREGADO) {
        entregasCompletadas += group._count.id;
      } else if (group.estado === DeliveryStatus.PENDIENTE) {
        entregasPendientes += group._count.id;
      } else if (group.estado === DeliveryStatus.NOVEDAD) {
        entregasConNovedad += group._count.id;
      }
    }

    // Bucket the 7-day order trend by ISO date (zero-filled)
    const buckets = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(desde7d);
      d.setDate(d.getDate() + i);
      buckets.set(d.toISOString().split('T')[0], 0);
    }
    for (const p of pedidosRecientes) {
      const key = p.fechaCreacion.toISOString().split('T')[0];
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }
    const tendencia = Array.from(buckets.entries()).map(([f, total]) => ({
      fecha: f,
      total,
    }));

    // Map driver alerts with remaining days until revalidation
    const msPorDia = 1000 * 60 * 60 * 24;
    const alertasChoferes = choferesAlerta.map((c) => ({
      nombre: `${c.nombre} ${c.apellido}`,
      fechaRevalidacion: c.fechaRevalidacion.toISOString().split('T')[0],
      dias: Math.ceil((c.fechaRevalidacion.getTime() - day.getTime()) / msPorDia),
    }));

    return {
      pedidos: {
        total: totalPedidos,
        porEstado,
      },
      despacho: {
        hojasDelDia,
        entregasCompletadas,
        entregasPendientes,
        entregasConNovedad,
      },
      recursos: {
        clientesActivos,
        productosActivos,
        rutasActivas,
        vehiculosActivos,
        choferesActivos,
      },
      pendientes: {
        porConfirmar,
        porDespachar,
        choferesPorRevalidar,
      },
      alertasChoferes,
      tendencia,
    };
  }

  async exportOrders(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    // hasta is inclusive — set to end of day
    hastaDate.setHours(23, 59, 59, 999);

    const orders = await this.prisma.pedido.findMany({
      where: {
        fechaCreacion: {
          gte: desdeDate,
          lte: hastaDate,
        },
      },
      include: {
        cliente: { select: { razonSocial: true } },
        detalles: { include: { producto: { select: { nombre: true } } } },
      },
      orderBy: { fechaCreacion: 'desc' },
      take: 10_000,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Pedidos');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Fecha Creación', key: 'fecha', width: 18 },
      { header: 'Cliente', key: 'cliente', width: 35 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Fecha Entrega', key: 'fechaEntrega', width: 18 },
      { header: 'Productos', key: 'productos', width: 50 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const order of orders) {
      const productos = order.detalles
        .map((d) => `${d.producto.nombre} (${d.cantidad.toNumber()} kg)`)
        .join(', ');

      sheet.addRow({
        id: order.id,
        fecha: order.fechaCreacion.toISOString().split('T')[0],
        cliente: order.cliente.razonSocial,
        estado: order.estado,
        fechaEntrega: order.fechaEntrega.toISOString().split('T')[0],
        productos,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportDispatch(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    const hojas = await this.prisma.hojaCarga.findMany({
      where: {
        fecha: {
          gte: desdeDate,
          lte: hastaDate,
        },
      },
      include: {
        ruta: { select: { nombre: true, zona: true } },
        vehiculo: { select: { placa: true } },
        chofer: { select: { nombre: true, apellido: true } },
        pedidos: {
          include: {
            cliente: { select: { razonSocial: true } },
            entrega: {
              select: {
                estado: true,
                fechaEntrega: true,
              },
            },
          },
        },
      },
      orderBy: { fecha: 'desc' },
      take: 10_000,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Despachos');

    sheet.columns = [
      { header: 'Hoja ID', key: 'hojaId', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Ruta', key: 'ruta', width: 20 },
      { header: 'Zona', key: 'zona', width: 15 },
      { header: 'Vehículo', key: 'vehiculo', width: 12 },
      { header: 'Chofer', key: 'chofer', width: 25 },
      { header: 'Estado Hoja', key: 'estadoHoja', width: 15 },
      { header: 'Pedido ID', key: 'pedidoId', width: 10 },
      { header: 'Cliente', key: 'cliente', width: 35 },
      { header: 'Estado Entrega', key: 'estadoEntrega', width: 15 },
      { header: 'Fecha Entrega', key: 'fechaEntrega', width: 18 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const hoja of hojas) {
      for (const pedido of hoja.pedidos) {
        sheet.addRow({
          hojaId: hoja.id,
          fecha: hoja.fecha.toISOString().split('T')[0],
          ruta: hoja.ruta.nombre,
          zona: hoja.ruta.zona,
          vehiculo: hoja.vehiculo.placa,
          chofer: `${hoja.chofer.nombre} ${hoja.chofer.apellido}`,
          estadoHoja: hoja.estado,
          pedidoId: pedido.id,
          cliente: pedido.cliente.razonSocial,
          estadoEntrega: pedido.entrega?.estado ?? 'SIN ENTREGA',
          fechaEntrega:
            pedido.entrega?.fechaEntrega?.toISOString().split('T')[0] ?? '',
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private defaultDesde(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }
}
