import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  DispatchStatus,
  DeliveryStatus,
  canTransition,
} from '@siadlp/shared';
import { CreateLoadSheetDto } from './dto/create-load-sheet.dto';
import { ConfirmDispatchDto } from './dto/confirm-dispatch.dto';
import { RegisterDeliveryDto } from './dto/register-delivery.dto';
import {
  DeliveryStatusEntry,
  RouteGroup,
  Parada,
  RouteSheetResult,
} from './dispatch.types';

@Injectable()
export class DispatchService {
  constructor(private readonly prisma: PrismaService) {}

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

      const pedidoData = {
        id: pedido.id,
        cliente: {
          id: pedido.cliente.id,
          razonSocial: pedido.cliente.razonSocial,
          direccion: pedido.cliente.direccion,
          telefono: pedido.cliente.telefono,
        },
        detalles: pedido.detalles.map((d) => ({
          productoId: d.productoId,
          cantidad: d.cantidad.toNumber(),
          producto: d.producto,
        })),
      };

      if (existing) {
        existing.pedidos.push(pedidoData);
        existing.totalKg += pedidoKg;
      } else {
        groupMap.set(ruta.id, {
          ruta: { id: ruta.id, nombre: ruta.nombre, zona: ruta.zona },
          pedidos: [pedidoData],
          totalKg: pedidoKg,
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
        throw new NotFoundException('Uno o más pedidos no fueron encontrados');
      }

      const notConfirmed = pedidos.filter(
        (p) => p.estado !== OrderStatus.CONFIRMED,
      );
      if (notConfirmed.length > 0) {
        throw new BadRequestException(
          `Los siguientes pedidos no están en estado CONFIRMED: ${notConfirmed.map((p) => p.id).join(', ')}`,
        );
      }

      const alreadyAssigned = pedidos.filter((p) => p.hojaCargaId !== null);
      if (alreadyAssigned.length > 0) {
        throw new BadRequestException(
          `Los siguientes pedidos ya están asignados a otra hoja de carga: ${alreadyAssigned.map((p) => p.id).join(', ')}`,
        );
      }

      const totalKg = pedidos.reduce((acc, pedido) => {
        return (
          acc +
          pedido.detalles.reduce((sum, d) => sum + d.cantidad.toNumber(), 0)
        );
      }, 0);

      // Validate ruta, vehiculo and chofer exist and are active
      const ruta = await tx.ruta.findUnique({ where: { id: dto.rutaId } });
      if (!ruta || !ruta.activa)
        throw new BadRequestException('Ruta no encontrada o inactiva');

      const vehiculo = await tx.vehiculo.findUnique({
        where: { id: dto.vehiculoId },
      });
      if (!vehiculo || !vehiculo.activo)
        throw new BadRequestException('Vehículo no encontrado o inactivo');

      const chofer = await tx.chofer.findUnique({
        where: { id: dto.choferId },
      });
      if (!chofer || !chofer.activo)
        throw new BadRequestException('Chofer no encontrado o inactivo');

      // Validate vehicle capacity
      if (totalKg > vehiculo.capacidadKg.toNumber()) {
        throw new BadRequestException(
          `El peso total (${totalKg.toFixed(2)} kg) excede la capacidad del vehículo (${vehiculo.capacidadKg.toNumber()} kg)`,
        );
      }

      const hoja = await tx.hojaCarga.create({
        data: {
          fecha: new Date(dto.fecha),
          rutaId: dto.rutaId,
          vehiculoId: dto.vehiculoId,
          choferId: dto.choferId,
          estado: DispatchStatus.PREPARANDO,
          totalKg,
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
          vehiculo: {
            select: { id: true, placa: true, marca: true, modelo: true },
          },
          chofer: { select: { id: true, nombre: true, apellido: true } },
        },
      });
    });
  }

  async findAll(fecha?: string, page = 1, pageSize = 20) {
    const where: Record<string, unknown> = {};

    if (fecha) {
      const day = new Date(fecha);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      where['fecha'] = { gte: day, lt: nextDay };
    }

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.hojaCarga.findMany({
        where,
        include: {
          ruta: { select: { id: true, nombre: true, zona: true } },
          vehiculo: { select: { id: true, placa: true, marca: true } },
          chofer: { select: { id: true, nombre: true, apellido: true } },
          _count: { select: { pedidos: true } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.hojaCarga.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async findOne(id: number) {
    const hoja = await this.prisma.hojaCarga.findUnique({
      where: { id },
      include: {
        ruta: { select: { id: true, nombre: true, zona: true } },
        vehiculo: {
          select: { id: true, placa: true, marca: true, modelo: true },
        },
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
            entrega: {
              select: {
                id: true,
                estado: true,
                observacion: true,
                fechaEntrega: true,
              },
            },
          },
        },
        creadoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!hoja) {
      throw new NotFoundException('Hoja de carga no encontrada');
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
                  producto: {
                    select: { id: true, nombre: true, unidadMedida: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!hoja) {
        throw new NotFoundException('Hoja de carga no encontrada');
      }

      if (hoja.estado !== DispatchStatus.PREPARANDO) {
        throw new BadRequestException(
          `Solo se puede confirmar una hoja en estado PREPARANDO. Estado actual: ${hoja.estado}`,
        );
      }

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
      }

      // Update hoja to DESPACHADO
      await tx.hojaCarga.update({
        where: { id },
        data: {
          estado: DispatchStatus.DESPACHADO,
        },
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
          vehiculo: {
            select: { id: true, placa: true, marca: true, modelo: true },
          },
          chofer: { select: { id: true, nombre: true, apellido: true } },
        },
      });
    });
  }

  async startRoute(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const hoja = await tx.hojaCarga.findUnique({
        where: { id },
        include: { pedidos: { select: { id: true, estado: true } } },
      });

      if (!hoja) {
        throw new NotFoundException('Hoja de carga no encontrada');
      }

      if (hoja.estado !== DispatchStatus.DESPACHADO) {
        throw new BadRequestException(
          `Solo se puede iniciar ruta en estado DESPACHADO. Estado actual: ${hoja.estado}`,
        );
      }

      for (const pedido of hoja.pedidos) {
        if (
          !canTransition(pedido.estado as OrderStatus, OrderStatus.ON_ROUTE)
        ) {
          throw new BadRequestException(
            `Pedido ${pedido.id} no puede transicionar de ${pedido.estado} a ON_ROUTE`,
          );
        }
      }

      await tx.pedido.updateMany({
        where: { hojaCargaId: id },
        data: { estado: OrderStatus.ON_ROUTE },
      });

      await tx.estadoPedidoLog.createMany({
        data: hoja.pedidos.map((p) => ({
          pedidoId: p.id,
          estadoAnterior: p.estado,
          estadoNuevo: OrderStatus.ON_ROUTE,
          motivo: `Inicio de ruta. Hoja de carga #${id}`,
          usuarioId: userId,
        })),
      });

      return tx.hojaCarga.update({
        where: { id },
        data: { estado: DispatchStatus.EN_RUTA },
        include: {
          ruta: { select: { id: true, nombre: true, zona: true } },
          vehiculo: { select: { id: true, placa: true } },
          chofer: { select: { id: true, nombre: true, apellido: true } },
          _count: { select: { pedidos: true } },
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
      throw new NotFoundException('Hoja de carga no encontrada');
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
      },
      productos: pedido.detalles.map((d) => ({
        nombre: d.producto.nombre,
        cantidad: d.cantidad.toNumber(),
      })),
    }));

    return {
      hoja: {
        id: hoja.id,
        fecha: hoja.fecha,
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
        throw new NotFoundException('Entrega no encontrada');
      }

      if (entrega.estado !== DeliveryStatus.PENDIENTE) {
        throw new BadRequestException(
          `La entrega ya fue registrada. Estado actual: ${entrega.estado}`,
        );
      }

      // Determine new order and delivery status
      const newOrderStatus =
        dto.estado === 'ENTREGADO' ? OrderStatus.DELIVERED : OrderStatus.ISSUE;
      const newDeliveryStatus =
        dto.estado === 'ENTREGADO'
          ? DeliveryStatus.ENTREGADO
          : DeliveryStatus.NOVEDAD;

      // Update entrega
      const updatedEntrega = await tx.entrega.update({
        where: { pedidoId },
        data: {
          estado: newDeliveryStatus,
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

      // Get current pedido estado for log and validate transition
      const pedido = await tx.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
        select: { estado: true },
      });

      if (
        !canTransition(
          pedido.estado as OrderStatus,
          newOrderStatus as OrderStatus,
        )
      ) {
        throw new BadRequestException(
          `No se puede transicionar de ${pedido.estado} a ${newOrderStatus}`,
        );
      }

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

      await this.checkAndCompleteHoja(tx, pedidoId);

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
                observacion: true,
                fechaEntrega: true,
              },
            },
          },
        },
      },
    });

    if (!hoja) {
      throw new NotFoundException('Hoja de carga no encontrada');
    }

    return hoja.pedidos.map((pedido) => ({
      pedidoId: pedido.id,
      cliente: { razonSocial: pedido.cliente.razonSocial },
      entrega: pedido.entrega
        ? {
            id: pedido.entrega.id,
            estado: pedido.entrega.estado,
            observacion: pedido.entrega.observacion,
            fechaEntrega: pedido.entrega.fechaEntrega,
          }
        : null,
    }));
  }

  private async checkAndCompleteHoja(
    tx: Prisma.TransactionClient,
    pedidoId: number,
  ): Promise<void> {
    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      select: { hojaCargaId: true },
    });

    if (!pedido?.hojaCargaId) return;

    const pendingCount = await tx.entrega.count({
      where: {
        pedido: { hojaCargaId: pedido.hojaCargaId },
        estado: 'PENDIENTE',
      },
    });

    if (pendingCount === 0) {
      await tx.hojaCarga.update({
        where: { id: pedido.hojaCargaId },
        data: { estado: 'COMPLETADO' },
      });
    }
  }
}
