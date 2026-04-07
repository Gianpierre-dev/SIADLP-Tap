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
}
