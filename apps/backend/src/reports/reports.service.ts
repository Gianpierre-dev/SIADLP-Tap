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

  async getDashboard(opts: {
    fecha: string;
    periodo: string;
    tendenciaDias: number;
  }): Promise<DashboardData> {
    const { fecha, periodo, tendenciaDias } = opts;
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    // Snapshot range for pedidos/despacho/entregas, driven by the period filter.
    // 'dia' = sólo hoy; 'semana' = últimos 7 días; 'mes' = últimos 30 días.
    const rangeStart = new Date(day);
    if (periodo === 'semana') {
      rangeStart.setDate(rangeStart.getDate() - 6);
    } else if (periodo === 'mes') {
      rangeStart.setDate(rangeStart.getDate() - 29);
    }

    // Trend window: `tendenciaDias` days ending today (inclusive)
    const dias = tendenciaDias > 0 ? tendenciaDias : 7;
    const trendStart = new Date(day);
    trendStart.setDate(trendStart.getDate() - (dias - 1));

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
        where: { fechaCreacion: { gte: rangeStart, lt: nextDay } },
        _count: { id: true },
      }),
      this.prisma.hojaCarga.count({
        where: { fecha: { gte: rangeStart, lt: nextDay } },
      }),
      this.prisma.entrega.groupBy({
        by: ['estado'],
        where: {
          pedido: {
            hojaCarga: { fecha: { gte: rangeStart, lt: nextDay } },
          },
        },
        _count: { id: true },
      }),
      this.prisma.cliente.count({ where: { activo: true } }),
      this.prisma.producto.count({ where: { activo: true } }),
      this.prisma.ruta.count({ where: { activa: true } }),
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
        where: { fechaCreacion: { gte: trendStart, lt: nextDay } },
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
    for (let i = 0; i < dias; i++) {
      const d = new Date(trendStart);
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

  // Encabezado branded para los reportes Excel: nombre de empresa, RUC, título
  // del reporte y período. Se inserta arriba de la tabla de datos.
  private async addReportHeader(
    sheet: ExcelJS.Worksheet,
    titulo: string,
    desde: string,
    hasta: string,
  ): Promise<void> {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: 1 },
      select: { razonSocial: true, nombreComercial: true, ruc: true },
    });
    const nombre =
      empresa?.nombreComercial ?? empresa?.razonSocial ?? 'La Cosecha S.A.C.';
    const colCount = Math.max(sheet.columns.length, 1);
    sheet.spliceRows(
      1,
      0,
      [nombre],
      [empresa?.ruc ? `RUC: ${empresa.ruc}` : ''],
      [titulo],
      [`Período: ${desde || '—'} a ${hasta || '—'}`],
      [],
    );
    sheet.mergeCells(1, 1, 1, colCount);
    sheet.mergeCells(2, 1, 2, colCount);
    sheet.mergeCells(3, 1, 3, colCount);
    sheet.mergeCells(4, 1, 4, colCount);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(2).font = { size: 10 };
    sheet.getRow(3).font = { bold: true, size: 12 };
    sheet.getRow(4).font = { italic: true, size: 10 };
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

    await this.addReportHeader(sheet, 'Reporte de Pedidos', desde, hasta);

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
                observacion: true,
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
      { header: 'Observación', key: 'observacion', width: 40 },
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
          observacion: pedido.entrega?.observacion ?? '',
          fechaEntrega:
            pedido.entrega?.fechaEntrega?.toISOString().split('T')[0] ?? '',
        });
      }
    }

    await this.addReportHeader(sheet, 'Reporte de Despachos', desde, hasta);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportIssues(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    // Entregas con NOVEDAD, filtradas por la fecha de la hoja de carga.
    const entregas = await this.prisma.entrega.findMany({
      where: {
        estado: DeliveryStatus.NOVEDAD,
        pedido: {
          hojaCarga: { fecha: { gte: desdeDate, lte: hastaDate } },
        },
      },
      include: {
        pedido: {
          include: {
            cliente: { select: { razonSocial: true } },
            hojaCarga: {
              include: {
                ruta: { select: { nombre: true } },
                chofer: { select: { nombre: true, apellido: true } },
              },
            },
          },
        },
      },
      orderBy: { fechaEntrega: 'desc' },
      take: 10_000,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Novedades');

    sheet.columns = [
      { header: 'Hoja ID', key: 'hojaId', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Ruta', key: 'ruta', width: 20 },
      { header: 'Cliente', key: 'cliente', width: 35 },
      { header: 'Chofer', key: 'chofer', width: 25 },
      { header: 'Observación', key: 'observacion', width: 45 },
      { header: 'Fecha/Hora Entrega', key: 'fechaEntrega', width: 22 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const entrega of entregas) {
      const hoja = entrega.pedido.hojaCarga;
      sheet.addRow({
        hojaId: hoja?.id ?? '',
        fecha: hoja?.fecha.toISOString().split('T')[0] ?? '',
        ruta: hoja?.ruta.nombre ?? '',
        cliente: entrega.pedido.cliente.razonSocial,
        chofer: hoja ? `${hoja.chofer.nombre} ${hoja.chofer.apellido}` : '',
        observacion: entrega.observacion ?? '',
        fechaEntrega: entrega.fechaEntrega?.toISOString().replace('T', ' ').slice(0, 19) ?? '',
      });
    }

    await this.addReportHeader(sheet, 'Reporte de Novedades', desde, hasta);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportByDriver(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    // Entregas en el rango (sobre hojaCarga.fecha) con su chofer, para agregar por chofer.
    const entregas = await this.prisma.entrega.findMany({
      where: {
        pedido: {
          hojaCarga: { fecha: { gte: desdeDate, lte: hastaDate } },
        },
      },
      select: {
        estado: true,
        pedido: {
          select: {
            hojaCarga: {
              select: {
                choferId: true,
                chofer: { select: { nombre: true, apellido: true } },
              },
            },
          },
        },
      },
      take: 50_000,
    });

    // Agrega contando entregas por chofer.
    const resumen = new Map<
      number,
      {
        nombre: string;
        total: number;
        entregadas: number;
        novedad: number;
        pendientes: number;
      }
    >();

    for (const entrega of entregas) {
      const hoja = entrega.pedido.hojaCarga;
      if (!hoja) continue;
      const key = hoja.choferId;
      let row = resumen.get(key);
      if (!row) {
        row = {
          nombre: `${hoja.chofer.nombre} ${hoja.chofer.apellido}`,
          total: 0,
          entregadas: 0,
          novedad: 0,
          pendientes: 0,
        };
        resumen.set(key, row);
      }
      row.total += 1;
      if (entrega.estado === DeliveryStatus.ENTREGADO) row.entregadas += 1;
      else if (entrega.estado === DeliveryStatus.NOVEDAD) row.novedad += 1;
      else if (entrega.estado === DeliveryStatus.PENDIENTE) row.pendientes += 1;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Por Chofer');

    sheet.columns = [
      { header: 'Chofer', key: 'chofer', width: 30 },
      { header: 'Total Entregas', key: 'total', width: 16 },
      { header: 'Entregadas', key: 'entregadas', width: 14 },
      { header: 'Con Novedad', key: 'novedad', width: 14 },
      { header: 'Pendientes', key: 'pendientes', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    const filas = Array.from(resumen.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
    for (const fila of filas) {
      sheet.addRow({
        chofer: fila.nombre,
        total: fila.total,
        entregadas: fila.entregadas,
        novedad: fila.novedad,
        pendientes: fila.pendientes,
      });
    }

    await this.addReportHeader(
      sheet,
      'Reporte de Entregas por Chofer',
      desde,
      hasta,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportByRoute(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    // Pedidos en el rango (sobre fechaCreacion), con su ruta vía cliente y su entrega.
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        fechaCreacion: { gte: desdeDate, lte: hastaDate },
      },
      select: {
        cliente: {
          select: {
            ruta: { select: { id: true, nombre: true, zona: true } },
          },
        },
        detalles: { select: { cantidad: true } },
        entrega: { select: { estado: true } },
      },
      take: 50_000,
    });

    // Agrega por ruta.
    const resumen = new Map<
      number,
      {
        ruta: string;
        zona: string;
        totalPedidos: number;
        totalKg: number;
        entregados: number;
        conNovedad: number;
      }
    >();

    for (const pedido of pedidos) {
      const ruta = pedido.cliente.ruta;
      const key = ruta.id;
      let row = resumen.get(key);
      if (!row) {
        row = {
          ruta: ruta.nombre,
          zona: ruta.zona,
          totalPedidos: 0,
          totalKg: 0,
          entregados: 0,
          conNovedad: 0,
        };
        resumen.set(key, row);
      }
      row.totalPedidos += 1;
      for (const d of pedido.detalles) {
        row.totalKg += d.cantidad.toNumber();
      }
      if (pedido.entrega?.estado === DeliveryStatus.ENTREGADO) {
        row.entregados += 1;
      } else if (pedido.entrega?.estado === DeliveryStatus.NOVEDAD) {
        row.conNovedad += 1;
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Por Ruta');

    sheet.columns = [
      { header: 'Ruta', key: 'ruta', width: 25 },
      { header: 'Zona', key: 'zona', width: 18 },
      { header: 'Total Pedidos', key: 'totalPedidos', width: 16 },
      { header: 'Total Kg', key: 'totalKg', width: 14 },
      { header: 'Entregados', key: 'entregados', width: 14 },
      { header: 'Con Novedad', key: 'conNovedad', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    const filas = Array.from(resumen.values()).sort((a, b) =>
      a.ruta.localeCompare(b.ruta),
    );
    for (const fila of filas) {
      sheet.addRow({
        ruta: fila.ruta,
        zona: fila.zona,
        totalPedidos: fila.totalPedidos,
        totalKg: fila.totalKg,
        entregados: fila.entregados,
        conNovedad: fila.conNovedad,
      });
    }

    await this.addReportHeader(sheet, 'Reporte por Ruta', desde, hasta);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportByClient(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    // Pedidos en el rango (sobre fechaCreacion), con su cliente y detalles.
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        fechaCreacion: { gte: desdeDate, lte: hastaDate },
      },
      select: {
        clienteId: true,
        cliente: {
          select: {
            razonSocial: true,
            ruc: true,
            ruta: { select: { nombre: true } },
          },
        },
        detalles: { select: { cantidad: true } },
      },
      take: 50_000,
    });

    // Agrega por cliente.
    const resumen = new Map<
      number,
      {
        cliente: string;
        ruc: string;
        ruta: string;
        totalPedidos: number;
        totalKg: number;
      }
    >();

    for (const pedido of pedidos) {
      const key = pedido.clienteId;
      let row = resumen.get(key);
      if (!row) {
        row = {
          cliente: pedido.cliente.razonSocial,
          ruc: pedido.cliente.ruc ?? '',
          ruta: pedido.cliente.ruta.nombre,
          totalPedidos: 0,
          totalKg: 0,
        };
        resumen.set(key, row);
      }
      row.totalPedidos += 1;
      for (const d of pedido.detalles) {
        row.totalKg += d.cantidad.toNumber();
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Por Cliente');

    sheet.columns = [
      { header: 'Cliente', key: 'cliente', width: 35 },
      { header: 'RUC', key: 'ruc', width: 16 },
      { header: 'Ruta', key: 'ruta', width: 25 },
      { header: 'Total Pedidos', key: 'totalPedidos', width: 16 },
      { header: 'Total Kg', key: 'totalKg', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    const filas = Array.from(resumen.values()).sort((a, b) =>
      a.cliente.localeCompare(b.cliente),
    );
    for (const fila of filas) {
      sheet.addRow({
        cliente: fila.cliente,
        ruc: fila.ruc,
        ruta: fila.ruta,
        totalPedidos: fila.totalPedidos,
        totalKg: fila.totalKg,
      });
    }

    await this.addReportHeader(sheet, 'Reporte por Cliente', desde, hasta);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private defaultDesde(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }
}
