import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryType, DeliveryStatus, ProductionStatus } from '@siadlp/shared';

export interface DashboardData {
  pedidos: {
    total: number;
    porEstado: Record<string, number>;
  };
  produccion: {
    lotesDelDia: number;
    kgProducidos: number;
    rendimientoPromedio: number;
  };
  inventario: {
    alertasMp: number;
    alertasPt: number;
  };
  despacho: {
    hojasDelDia: number;
    entregasCompletadas: number;
    entregasPendientes: number;
    entregasConNovedad: number;
  };
  cobros: {
    totalCobrado: number;
    cantidadCobros: number;
  };
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(fecha: string): Promise<DashboardData> {
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    // Pedidos creados en el día, agrupados por estado
    const pedidosGrouped = await this.prisma.pedido.groupBy({
      by: ['estado'],
      where: {
        fechaCreacion: { gte: day, lt: nextDay },
      },
      _count: { id: true },
    });

    const porEstado: Record<string, number> = {};
    let totalPedidos = 0;
    for (const group of pedidosGrouped) {
      porEstado[group.estado] = group._count.id;
      totalPedidos += group._count.id;
    }

    // Producción: órdenes completadas en el día
    const ordenesProduccion = await this.prisma.ordenProduccion.findMany({
      where: {
        fecha: { gte: day, lt: nextDay },
        estado: ProductionStatus.COMPLETADA,
      },
      include: {
        productos: { select: { cantidad: true } },
      },
    });

    let kgProducidos = 0;
    let rendimientoTotal = 0;

    for (const orden of ordenesProduccion) {
      const kgOrden = orden.productos.reduce(
        (acc, p) => acc + p.cantidad.toNumber(),
        0,
      );
      kgProducidos += kgOrden;
    }

    // Rendimiento: calculamos como kgProducidos / lotes (simplificado)
    // Si hay datos de insumos, la lógica real sería (output/input)*100
    const lotesDelDia = ordenesProduccion.length;
    if (lotesDelDia > 0) {
      // Obtener insumos para calcular rendimiento real
      const ordenesConInsumos = await this.prisma.ordenProduccion.findMany({
        where: {
          fecha: { gte: day, lt: nextDay },
          estado: ProductionStatus.COMPLETADA,
        },
        include: {
          productos: { select: { cantidad: true } },
          insumos: { select: { cantidad: true } },
        },
      });

      for (const orden of ordenesConInsumos) {
        const kgSalida = orden.productos.reduce(
          (acc, p) => acc + p.cantidad.toNumber(),
          0,
        );
        const kgEntrada = orden.insumos.reduce(
          (acc, i) => acc + i.cantidad.toNumber(),
          0,
        );
        if (kgEntrada > 0) {
          rendimientoTotal += (kgSalida / kgEntrada) * 100;
        }
      }
    }

    const rendimientoPromedio = lotesDelDia > 0 ? rendimientoTotal / lotesDelDia : 0;

    // Inventario: alertas (stockActual <= stockMinimo y stockMinimo > 0)
    // Prisma no soporta comparación campo-a-campo directa, filtramos en código
    const itemsConStockMinimo = await this.prisma.itemInventario.findMany({
      where: {
        activo: true,
        stockMinimo: { gt: 0 },
      },
      select: {
        tipo: true,
        stockActual: true,
        stockMinimo: true,
      },
    });

    let alertasMp = 0;
    let alertasPt = 0;

    for (const item of itemsConStockMinimo) {
      if (item.stockActual.toNumber() <= item.stockMinimo.toNumber()) {
        if (item.tipo === InventoryType.MATERIA_PRIMA) {
          alertasMp++;
        } else if (item.tipo === InventoryType.PRODUCTO_TERMINADO) {
          alertasPt++;
        }
      }
    }

    // Hojas de carga del día
    const hojasDelDia = await this.prisma.hojaCarga.count({
      where: {
        fecha: { gte: day, lt: nextDay },
      },
    });

    // Entregas del día (asociadas a hojas del día)
    const entregasDelDia = await this.prisma.entrega.groupBy({
      by: ['estado'],
      where: {
        pedido: {
          hojaCarga: {
            fecha: { gte: day, lt: nextDay },
          },
        },
      },
      _count: { id: true },
    });

    let entregasCompletadas = 0;
    let entregasPendientes = 0;
    let entregasConNovedad = 0;

    for (const group of entregasDelDia) {
      if (
        group.estado === DeliveryStatus.ENTREGADO ||
        group.estado === DeliveryStatus.COBRADO
      ) {
        entregasCompletadas += group._count.id;
      } else if (group.estado === DeliveryStatus.PENDIENTE) {
        entregasPendientes += group._count.id;
      } else if (group.estado === DeliveryStatus.NOVEDAD) {
        entregasConNovedad += group._count.id;
      }
    }

    // Cobros del día
    const cobrosDelDia = await this.prisma.entrega.aggregate({
      where: {
        estado: DeliveryStatus.COBRADO,
        fechaEntrega: { gte: day, lt: nextDay },
      },
      _sum: { montoCobrado: true },
      _count: { id: true },
    });

    return {
      pedidos: {
        total: totalPedidos,
        porEstado,
      },
      produccion: {
        lotesDelDia,
        kgProducidos: Math.round(kgProducidos * 100) / 100,
        rendimientoPromedio: Math.round(rendimientoPromedio * 100) / 100,
      },
      inventario: {
        alertasMp,
        alertasPt,
      },
      despacho: {
        hojasDelDia,
        entregasCompletadas,
        entregasPendientes,
        entregasConNovedad,
      },
      cobros: {
        totalCobrado: cobrosDelDia._sum.montoCobrado?.toNumber() ?? 0,
        cantidadCobros: cobrosDelDia._count.id,
      },
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
      { header: 'Total (S/)', key: 'total', width: 15 },
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
        total: order.total.toNumber(),
        fechaEntrega: order.fechaEntrega.toISOString().split('T')[0],
        productos,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportProduction(desde: string, hasta: string): Promise<Buffer> {
    const desdeDate = desde ? new Date(desde) : this.defaultDesde();
    const hastaDate = hasta ? new Date(hasta) : new Date();
    hastaDate.setHours(23, 59, 59, 999);

    const ordenes = await this.prisma.ordenProduccion.findMany({
      where: {
        fecha: {
          gte: desdeDate,
          lte: hastaDate,
        },
      },
      include: {
        productos: { include: { producto: { select: { nombre: true } } } },
        insumos: { include: { itemInventario: { select: { nombre: true } } } },
        creadoPor: { select: { nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Producción');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Kg Producidos', key: 'kgProducidos', width: 15 },
      { header: 'Costo Insumos (S/)', key: 'costoInsumos', width: 20 },
      { header: 'Rendimiento (%)', key: 'rendimiento', width: 18 },
      { header: 'Productos', key: 'productos', width: 40 },
      { header: 'Creado Por', key: 'creadoPor', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const orden of ordenes) {
      const kgProducidos = orden.productos.reduce(
        (acc, p) => acc + p.cantidad.toNumber(),
        0,
      );
      const kgEntrada = orden.insumos.reduce(
        (acc, i) => acc + i.cantidad.toNumber(),
        0,
      );
      const costoInsumos = orden.insumos.reduce(
        (acc, i) => acc + i.costoTotal.toNumber(),
        0,
      );
      const rendimiento =
        kgEntrada > 0
          ? Math.round((kgProducidos / kgEntrada) * 10000) / 100
          : 0;

      const productos = orden.productos
        .map((p) => `${p.producto.nombre} (${p.cantidad.toNumber()} kg)`)
        .join(', ');

      sheet.addRow({
        id: orden.id,
        fecha: orden.fecha.toISOString().split('T')[0],
        estado: orden.estado,
        kgProducidos: Math.round(kgProducidos * 100) / 100,
        costoInsumos: Math.round(costoInsumos * 100) / 100,
        rendimiento,
        productos,
        creadoPor: orden.creadoPor.nombre,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async exportInventory(): Promise<Buffer> {
    const items = await this.prisma.itemInventario.findMany({
      where: { activo: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIADLP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inventario');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Tipo', key: 'tipo', width: 20 },
      { header: 'Nombre', key: 'nombre', width: 35 },
      { header: 'Unidad', key: 'unidad', width: 12 },
      { header: 'Stock Actual', key: 'stockActual', width: 15 },
      { header: 'Stock Mínimo', key: 'stockMinimo', width: 15 },
      { header: 'Estado', key: 'estado', width: 15 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    for (const item of items) {
      const stockActual = item.stockActual.toNumber();
      const stockMinimo = item.stockMinimo.toNumber();
      const alerta = stockMinimo > 0 && stockActual <= stockMinimo;

      const row = sheet.addRow({
        id: item.id,
        tipo: item.tipo,
        nombre: item.nombre,
        unidad: item.unidadMedida,
        stockActual,
        stockMinimo,
        estado: alerta ? 'ALERTA' : 'OK',
      });

      // Highlight rows with alerts
      if (alerta) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFCE4D6' },
        };
      }
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
                montoCobrado: true,
                metodoPago: true,
                fechaEntrega: true,
              },
            },
          },
        },
      },
      orderBy: { fecha: 'desc' },
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
      { header: 'Total Pedido (S/)', key: 'totalPedido', width: 18 },
      { header: 'Estado Entrega', key: 'estadoEntrega', width: 15 },
      { header: 'Monto Cobrado (S/)', key: 'montoCobrado', width: 20 },
      { header: 'Método Pago', key: 'metodoPago', width: 15 },
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
          totalPedido: pedido.total.toNumber(),
          estadoEntrega: pedido.entrega?.estado ?? 'SIN ENTREGA',
          montoCobrado: pedido.entrega?.montoCobrado?.toNumber() ?? 0,
          metodoPago: pedido.entrega?.metodoPago ?? '',
          fechaEntrega: pedido.entrega?.fechaEntrega?.toISOString().split('T')[0] ?? '',
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
