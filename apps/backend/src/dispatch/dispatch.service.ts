import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  OrderStatus,
  DispatchStatus,
  DeliveryStatus,
  MovementType,
  InventoryType,
} from '@siadlp/shared';
import { CreateLoadSheetDto } from './dto/create-load-sheet.dto';
import { ConfirmDispatchDto } from './dto/confirm-dispatch.dto';
import { RegisterDeliveryDto } from './dto/register-delivery.dto';
import { RegisterCollectionDto } from './dto/register-collection.dto';

interface DeliveryStatusEntry {
  pedidoId: number;
  cliente: { razonSocial: string };
  entrega: {
    id: number;
    estado: string;
    montoCobrado: number | null;
    metodoPago: string | null;
    numeroComprobante: string | null;
    observacion: string | null;
    fechaEntrega: Date | null;
  } | null;
  totalPedido: number;
}

interface DailyCollectionSummary {
  porChofer: Array<{
    chofer: { nombre: string; apellido: string };
    totalCobrado: number;
    cantidadEntregas: number;
  }>;
  porRuta: Array<{
    ruta: { nombre: string; zona: string };
    totalCobrado: number;
    cantidadEntregas: number;
  }>;
  totalGeneral: number;
  totalEntregas: number;
}

interface RouteGroup {
  ruta: { id: number; nombre: string; zona: string };
  pedidos: Array<{
    id: number;
    total: number;
    cliente: { id: number; razonSocial: string; direccion: string; telefono: string | null };
    detalles: Array<{
      productoId: number;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
      producto: { id: number; nombre: string };
    }>;
  }>;
  totalKg: number;
  totalMonto: number;
}

interface Parada {
  orden: number;
  cliente: { razonSocial: string; direccion: string; telefono: string | null };
  pedido: { id: number; total: number };
  productos: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  montoACobrar: number;
}

interface RouteSheetResult {
  hoja: { id: number; fecha: Date; numeroGre: string | null; estado: string };
  ruta: { nombre: string; zona: string };
  vehiculo: { placa: string; marca: string | null; modelo: string | null };
  chofer: { nombre: string; apellido: string; dni: string; licencia: string | null; telefono: string | null };
  paradas: Parada[];
  totalKg: number;
  totalMonto: number;
}

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getOrdersGroupedByRoute(fecha: string): Promise<RouteGroup[]> {
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        estado: OrderStatus.CONFIRMED,
        fechaEntrega: { gte: day, lt: nextDay },
      },
      include: {
        cliente: {
          select: {
            id: true,
            razonSocial: true,
            direccion: true,
            telefono: true,
            ruta: {
              select: { id: true, nombre: true, zona: true },
            },
          },
        },
        detalles: {
          include: {
            producto: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    const groupMap = new Map<number, RouteGroup>();

    for (const pedido of pedidos) {
      const ruta = pedido.cliente.ruta;
      if (!ruta) continue;

      const existing = groupMap.get(ruta.id);

      const pedidoKg = pedido.detalles.reduce(
        (acc, d) => acc + d.cantidad.toNumber(),
        0,
      );
      const pedidoMonto = pedido.total.toNumber();

      const pedidoData = {
        id: pedido.id,
        total: pedidoMonto,
        cliente: {
          id: pedido.cliente.id,
          razonSocial: pedido.cliente.razonSocial,
          direccion: pedido.cliente.direccion,
          telefono: pedido.cliente.telefono,
        },
        detalles: pedido.detalles.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad.toNumber(),
          precioUnitario: d.precioUnitario.toNumber(),
          subtotal: d.subtotal.toNumber(),
          producto: d.producto,
        })),
      };

      if (existing) {
        existing.pedidos.push(pedidoData);
        existing.totalKg += pedidoKg;
        existing.totalMonto += pedidoMonto;
      } else {
        groupMap.set(ruta.id, {
          ruta: { id: ruta.id, nombre: ruta.nombre, zona: ruta.zona },
          pedidos: [pedidoData],
          totalKg: pedidoKg,
          totalMonto: pedidoMonto,
        });
      }
    }

    return Array.from(groupMap.values());
  }

  async create(dto: CreateLoadSheetDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const pedidos = await tx.pedido.findMany({
        where: { id: { in: dto.pedidoIds } },
        include: { detalles: true },
      });

      if (pedidos.length !== dto.pedidoIds.length) {
        const foundIds = new Set(pedidos.map((p) => p.id));
        const missing = dto.pedidoIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException(
          `Pedidos no encontrados: ${missing.join(', ')}`,
        );
      }

      const notConfirmed = pedidos.filter((p) => p.estado !== OrderStatus.CONFIRMED);
      if (notConfirmed.length > 0) {
        throw new BadRequestException(
          `Los siguientes pedidos no están en estado CONFIRMED: ${notConfirmed.map((p) => p.id).join(', ')}`,
        );
      }

      const totalKg = pedidos.reduce((acc, pedido) => {
        return acc + pedido.detalles.reduce((sum, d) => sum + d.cantidad.toNumber(), 0);
      }, 0);

      const totalMonto = pedidos.reduce(
        (acc, pedido) => acc + pedido.total.toNumber(),
        0,
      );

      const hoja = await tx.hojaCarga.create({
        data: {
          fecha: new Date(dto.fecha),
          rutaId: dto.rutaId,
          vehiculoId: dto.vehiculoId,
          choferId: dto.choferId,
          estado: DispatchStatus.PREPARANDO,
          totalKg,
          totalMonto,
          creadoPorId: userId,
        },
      });

      await tx.pedido.updateMany({
        where: { id: { in: dto.pedidoIds } },
        data: { hojaCargaId: hoja.id },
      });

      return tx.hojaCarga.findUnique({
        where: { id: hoja.id },
        include: {
          pedidos: {
            include: {
              cliente: { select: { id: true, razonSocial: true } },
            },
          },
          ruta: { select: { id: true, nombre: true, zona: true } },
          vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
          chofer: { select: { id: true, nombre: true, apellido: true } },
        },
      });
    });
  }

  async findAll(fecha?: string) {
    const where: Record<string, unknown> = {};

    if (fecha) {
      const day = new Date(fecha);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where['fecha'] = { gte: day, lt: nextDay };
    }

    return this.prisma.hojaCarga.findMany({
      where,
      include: {
        ruta: { select: { id: true, nombre: true, zona: true } },
        vehiculo: { select: { id: true, placa: true, marca: true } },
        chofer: { select: { id: true, nombre: true, apellido: true } },
        _count: { select: { pedidos: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: number) {
    const hoja = await this.prisma.hojaCarga.findUnique({
      where: { id },
      include: {
        ruta: { select: { id: true, nombre: true, zona: true } },
        vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
        chofer: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            dni: true,
            licencia: true,
            telefono: true,
          },
        },
        pedidos: {
          include: {
            cliente: { select: { id: true, razonSocial: true } },
            detalles: {
              include: {
                producto: { select: { id: true, nombre: true } },
              },
            },
            entrega: { select: { id: true, estado: true } },
          },
        },
        creadoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!hoja) {
      throw new NotFoundException(`Hoja de carga con id ${id} no encontrada`);
    }

    return hoja;
  }

  async confirmDispatch(id: number, dto: ConfirmDispatchDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const hoja = await tx.hojaCarga.findUnique({
        where: { id },
        include: {
          pedidos: {
            include: {
              detalles: {
                include: {
                  producto: { select: { id: true, nombre: true, unidadMedida: true } },
                },
              },
            },
          },
        },
      });

      if (!hoja) {
        throw new NotFoundException(`Hoja de carga con id ${id} no encontrada`);
      }

      if (hoja.estado !== DispatchStatus.PREPARANDO) {
        throw new BadRequestException(
          `Solo se puede confirmar una hoja en estado PREPARANDO. Estado actual: ${hoja.estado}`,
        );
      }

      // Update hoja to DESPACHADO and set GRE if provided
      await tx.hojaCarga.update({
        where: { id },
        data: {
          estado: DispatchStatus.DESPACHADO,
          ...(dto.numeroGre ? { numeroGre: dto.numeroGre } : {}),
        },
      });

      const referencia = `HC-${id}`;

      // Process each pedido
      for (const pedido of hoja.pedidos) {
        // Update pedido estado to DISPATCHED
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { estado: OrderStatus.DISPATCHED },
        });

        // Create estado log: CONFIRMED → DISPATCHED
        await tx.estadoPedidoLog.create({
          data: {
            pedidoId: pedido.id,
            estadoAnterior: OrderStatus.CONFIRMED,
            estadoNuevo: OrderStatus.DISPATCHED,
            motivo: `Despacho confirmado. Hoja de carga #${id}`,
            usuarioId: userId,
          },
        });

        // Create Entrega record
        await tx.entrega.create({
          data: {
            pedidoId: pedido.id,
            estado: DeliveryStatus.PENDIENTE,
            registradoPorId: userId,
          },
        });

        // Deduct PT stock for each detalle
        for (const detalle of pedido.detalles) {
          const ptItem = await tx.itemInventario.findFirst({
            where: {
              tipo: InventoryType.PRODUCTO_TERMINADO,
              nombre: detalle.producto.nombre,
            },
          });

          if (!ptItem) {
            console.warn(
              `[DispatchService] Item PT no encontrado para producto "${detalle.producto.nombre}" (id: ${detalle.productoId}). Se omite descuento de stock.`,
            );
            continue;
          }

          await this.inventoryService.registerMovement(
            tx,
            ptItem.id,
            MovementType.DESPACHO_SALIDA,
            detalle.cantidad.toNumber(),
            referencia,
            userId,
          );
        }
      }

      // Transition hoja to EN_RUTA
      await tx.hojaCarga.update({
        where: { id },
        data: { estado: DispatchStatus.EN_RUTA },
      });

      return tx.hojaCarga.findUnique({
        where: { id },
        include: {
          pedidos: {
            include: {
              cliente: { select: { id: true, razonSocial: true } },
              entrega: { select: { id: true, estado: true } },
            },
          },
          ruta: { select: { id: true, nombre: true, zona: true } },
          vehiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
          chofer: { select: { id: true, nombre: true, apellido: true } },
        },
      });
    });
  }

  async getRouteSheet(id: number): Promise<RouteSheetResult> {
    const hoja = await this.prisma.hojaCarga.findUnique({
      where: { id },
      include: {
        ruta: { select: { id: true, nombre: true, zona: true } },
        vehiculo: { select: { placa: true, marca: true, modelo: true } },
        chofer: {
          select: {
            nombre: true,
            apellido: true,
            dni: true,
            licencia: true,
            telefono: true,
          },
        },
        pedidos: {
          include: {
            cliente: {
              select: {
                id: true,
                razonSocial: true,
                direccion: true,
                telefono: true,
              },
            },
            detalles: {
              include: {
                producto: { select: { id: true, nombre: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!hoja) {
      throw new NotFoundException(`Hoja de carga con id ${id} no encontrada`);
    }

    const paradas: Parada[] = hoja.pedidos.map((pedido, index) => ({
      orden: index + 1,
      cliente: {
        razonSocial: pedido.cliente.razonSocial,
        direccion: pedido.cliente.direccion,
        telefono: pedido.cliente.telefono,
      },
      pedido: {
        id: pedido.id,
        total: pedido.total.toNumber(),
      },
      productos: pedido.detalles.map((d) => ({
        nombre: d.producto.nombre,
        cantidad: d.cantidad.toNumber(),
        precioUnitario: d.precioUnitario.toNumber(),
        subtotal: d.subtotal.toNumber(),
      })),
      montoACobrar: pedido.total.toNumber(),
    }));

    return {
      hoja: {
        id: hoja.id,
        fecha: hoja.fecha,
        numeroGre: hoja.numeroGre,
        estado: hoja.estado,
      },
      ruta: { nombre: hoja.ruta.nombre, zona: hoja.ruta.zona },
      vehiculo: {
        placa: hoja.vehiculo.placa,
        marca: hoja.vehiculo.marca,
        modelo: hoja.vehiculo.modelo,
      },
      chofer: {
        nombre: hoja.chofer.nombre,
        apellido: hoja.chofer.apellido,
        dni: hoja.chofer.dni,
        licencia: hoja.chofer.licencia,
        telefono: hoja.chofer.telefono,
      },
      paradas,
      totalKg: hoja.totalKg.toNumber(),
      totalMonto: hoja.totalMonto.toNumber(),
    };
  }

  async registerDelivery(
    pedidoId: number,
    dto: RegisterDeliveryDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const entrega = await tx.entrega.findUnique({
        where: { pedidoId },
      });

      if (!entrega) {
        throw new NotFoundException(
          `Entrega para pedido ${pedidoId} no encontrada`,
        );
      }

      if (entrega.estado !== DeliveryStatus.PENDIENTE) {
        throw new BadRequestException(
          `La entrega ya fue registrada. Estado actual: ${entrega.estado}`,
        );
      }

      // Determine new order status
      let newOrderStatus: string;
      if (
        dto.estado === 'ENTREGADO' &&
        dto.montoCobrado !== undefined &&
        dto.montoCobrado > 0
      ) {
        newOrderStatus = OrderStatus.COLLECTED;
      } else if (dto.estado === 'ENTREGADO') {
        newOrderStatus = OrderStatus.DELIVERED;
      } else {
        newOrderStatus = OrderStatus.ISSUE;
      }

      // Determine new delivery status
      const newDeliveryStatus =
        newOrderStatus === OrderStatus.COLLECTED
          ? DeliveryStatus.COBRADO
          : dto.estado === 'ENTREGADO'
            ? DeliveryStatus.ENTREGADO
            : DeliveryStatus.NOVEDAD;

      // Update entrega
      const updatedEntrega = await tx.entrega.update({
        where: { pedidoId },
        data: {
          estado: newDeliveryStatus,
          montoCobrado: dto.montoCobrado,
          metodoPago: dto.metodoPago,
          numeroComprobante: dto.numeroComprobante,
          observacion: dto.observacion,
          fechaEntrega: new Date(),
          registradoPorId: userId,
        },
        include: {
          pedido: {
            include: {
              cliente: { select: { id: true, razonSocial: true } },
            },
          },
        },
      });

      // Get current pedido estado for log
      const pedido = await tx.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
        select: { estado: true },
      });

      // Update pedido estado
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: newOrderStatus },
      });

      // Create log
      await tx.estadoPedidoLog.create({
        data: {
          pedidoId,
          estadoAnterior: pedido.estado,
          estadoNuevo: newOrderStatus,
          motivo: `Entrega registrada por chofer. Estado: ${dto.estado}`,
          usuarioId: userId,
        },
      });

      return updatedEntrega;
    });
  }

  async getDeliveryStatus(hojaCargaId: number): Promise<DeliveryStatusEntry[]> {
    const hoja = await this.prisma.hojaCarga.findUnique({
      where: { id: hojaCargaId },
      include: {
        pedidos: {
          include: {
            cliente: { select: { razonSocial: true } },
            entrega: {
              select: {
                id: true,
                estado: true,
                montoCobrado: true,
                metodoPago: true,
                numeroComprobante: true,
                observacion: true,
                fechaEntrega: true,
              },
            },
          },
        },
      },
    });

    if (!hoja) {
      throw new NotFoundException(
        `Hoja de carga con id ${hojaCargaId} no encontrada`,
      );
    }

    return hoja.pedidos.map((pedido) => ({
      pedidoId: pedido.id,
      cliente: { razonSocial: pedido.cliente.razonSocial },
      entrega: pedido.entrega
        ? {
            id: pedido.entrega.id,
            estado: pedido.entrega.estado,
            montoCobrado: pedido.entrega.montoCobrado?.toNumber() ?? null,
            metodoPago: pedido.entrega.metodoPago,
            numeroComprobante: pedido.entrega.numeroComprobante,
            observacion: pedido.entrega.observacion,
            fechaEntrega: pedido.entrega.fechaEntrega,
          }
        : null,
      totalPedido: pedido.total.toNumber(),
    }));
  }

  async registerCollection(
    pedidoId: number,
    dto: RegisterCollectionDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        select: { id: true, estado: true },
      });

      if (!pedido) {
        throw new NotFoundException(`Pedido ${pedidoId} no encontrado`);
      }

      if (pedido.estado !== OrderStatus.DELIVERED) {
        throw new BadRequestException(
          `Solo se puede cobrar un pedido en estado DELIVERED. Estado actual: ${pedido.estado}`,
        );
      }

      const entrega = await tx.entrega.findUnique({
        where: { pedidoId },
      });

      if (!entrega) {
        throw new NotFoundException(
          `Entrega para pedido ${pedidoId} no encontrada`,
        );
      }

      // Update entrega
      const updatedEntrega = await tx.entrega.update({
        where: { pedidoId },
        data: {
          montoCobrado: dto.montoCobrado,
          metodoPago: dto.metodoPago,
          numeroComprobante: dto.numeroComprobante,
          estado: DeliveryStatus.COBRADO,
        },
        include: {
          pedido: {
            include: {
              cliente: { select: { id: true, razonSocial: true } },
            },
          },
        },
      });

      // Update pedido
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: OrderStatus.COLLECTED },
      });

      // Create log
      await tx.estadoPedidoLog.create({
        data: {
          pedidoId,
          estadoAnterior: OrderStatus.DELIVERED,
          estadoNuevo: OrderStatus.COLLECTED,
          motivo: 'Cobro registrado por separado',
          usuarioId: userId,
        },
      });

      return updatedEntrega;
    });
  }

  async getDailyCollectionSummary(
    fecha: string,
  ): Promise<DailyCollectionSummary> {
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const entregas = await this.prisma.entrega.findMany({
      where: {
        estado: DeliveryStatus.COBRADO,
        fechaEntrega: { gte: day, lt: nextDay },
      },
      include: {
        pedido: {
          include: {
            hojaCarga: {
              include: {
                chofer: { select: { nombre: true, apellido: true } },
                ruta: { select: { nombre: true, zona: true } },
              },
            },
          },
        },
      },
    });

    const choferMap = new Map<
      string,
      { chofer: { nombre: string; apellido: string }; totalCobrado: number; cantidadEntregas: number }
    >();

    const rutaMap = new Map<
      string,
      { ruta: { nombre: string; zona: string }; totalCobrado: number; cantidadEntregas: number }
    >();

    let totalGeneral = 0;

    for (const entrega of entregas) {
      const monto = entrega.montoCobrado?.toNumber() ?? 0;
      const hojaCarga = entrega.pedido.hojaCarga;

      if (!hojaCarga) continue;

      totalGeneral += monto;

      // Group by chofer
      const choferKey = `${hojaCarga.chofer.nombre}_${hojaCarga.chofer.apellido}`;
      const existingChofer = choferMap.get(choferKey);
      if (existingChofer) {
        existingChofer.totalCobrado += monto;
        existingChofer.cantidadEntregas += 1;
      } else {
        choferMap.set(choferKey, {
          chofer: { nombre: hojaCarga.chofer.nombre, apellido: hojaCarga.chofer.apellido },
          totalCobrado: monto,
          cantidadEntregas: 1,
        });
      }

      // Group by ruta
      const rutaKey = hojaCarga.ruta.nombre;
      const existingRuta = rutaMap.get(rutaKey);
      if (existingRuta) {
        existingRuta.totalCobrado += monto;
        existingRuta.cantidadEntregas += 1;
      } else {
        rutaMap.set(rutaKey, {
          ruta: { nombre: hojaCarga.ruta.nombre, zona: hojaCarga.ruta.zona },
          totalCobrado: monto,
          cantidadEntregas: 1,
        });
      }
    }

    return {
      porChofer: Array.from(choferMap.values()),
      porRuta: Array.from(rutaMap.values()),
      totalGeneral,
      totalEntregas: entregas.length,
    };
  }
}
