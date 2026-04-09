import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition, OrderStatus } from '@siadlp/shared';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';

const PRODUCTO_SELECT = {
  id: true,
  nombre: true,
  codigoSku: true,
} as const;

const CLIENTE_SELECT = {
  id: true,
  razonSocial: true,
} as const;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto, userId: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
    });

    if (!cliente || !cliente.activo) {
      throw new NotFoundException('Cliente no encontrado o inactivo');
    }

    // Batch fetch all products at once (avoid N+1) — validate existence and active status
    const productoIds = dto.detalles.map((d) => d.productoId);
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: productoIds } },
    });

    const productosMap = new Map(productos.map((p) => [p.id, p]));

    const missingIds = productoIds.filter((id) => !productosMap.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException('Uno o más productos no fueron encontrados');
    }

    const inactiveProducts = productos.filter((p) => !p.activo);
    if (inactiveProducts.length > 0) {
      throw new BadRequestException('Uno o más productos no están activos');
    }

    const lineas = dto.detalles.map((line) => ({
      productoId: line.productoId,
      cantidad: line.cantidad,
    }));

    const pedido = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pedido.create({
        data: {
          clienteId: dto.clienteId,
          fechaEntrega: new Date(dto.fechaEntrega),
          observacion: dto.observacion,
          creadoPorId: userId,
          detalles: {
            create: lineas.map((l) => ({
              productoId: l.productoId,
              cantidad: l.cantidad,
            })),
          },
        },
        include: {
          detalles: { include: { producto: { select: PRODUCTO_SELECT } } },
          cliente: { select: CLIENTE_SELECT },
        },
      });

      await tx.estadoPedidoLog.create({
        data: {
          pedidoId: created.id,
          estadoAnterior: null,
          estadoNuevo: OrderStatus.REGISTERED,
          usuarioId: userId,
        },
      });

      return created;
    });

    return pedido;
  }

  async changeStatus(id: number, dto: ChangeOrderStatusDto, userId: number) {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const currentStatus = pedido.estado as OrderStatus;
    const newStatus = dto.nuevoEstado as OrderStatus;

    if (newStatus === OrderStatus.DISPATCHED) {
      throw new BadRequestException(
        'La transición a DISPATCHED solo se realiza mediante el módulo de despacho',
      );
    }

    if (!canTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `No se puede transicionar de ${currentStatus} a ${newStatus}`,
      );
    }

    if (newStatus === OrderStatus.CANCELLED && !dto.motivo) {
      throw new BadRequestException(
        'Se requiere un motivo para cancelar el pedido',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.pedido.update({
        where: { id },
        data: { estado: newStatus },
        include: {
          detalles: { include: { producto: { select: PRODUCTO_SELECT } } },
          cliente: { select: CLIENTE_SELECT },
          estadoLogs: {
            orderBy: { fechaCreacion: 'desc' },
            include: {
              usuario: { select: { id: true, nombre: true } },
            },
          },
        },
      });

      await tx.estadoPedidoLog.create({
        data: {
          pedidoId: id,
          estadoAnterior: currentStatus,
          estadoNuevo: newStatus,
          motivo: dto.motivo,
          usuarioId: userId,
        },
      });

      return result;
    });

    return updated;
  }

  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.pedido.findMany({
        include: {
          cliente: { select: { id: true, razonSocial: true } },
          _count: { select: { detalles: true } },
        },
        orderBy: { fechaCreacion: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.pedido.count(),
    ]);
    return { data, total, page, pageSize };
  }

  async findOne(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: {
        detalles: { include: { producto: { select: PRODUCTO_SELECT } } },
        cliente: { select: CLIENTE_SELECT },
        estadoLogs: {
          orderBy: { fechaCreacion: 'asc' },
          include: {
            usuario: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return pedido;
  }

  async findByDate(fecha: string) {
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.prisma.pedido.findMany({
      where: {
        fechaEntrega: { gte: day, lt: nextDay },
      },
      include: {
        cliente: { select: CLIENTE_SELECT },
        _count: { select: { detalles: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async findHistory(filters: {
    estado?: string;
    clienteId?: number;
    desde?: string;
    hasta?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.estado) {
      where['estado'] = filters.estado;
    }

    if (filters.clienteId) {
      where['clienteId'] = filters.clienteId;
    }

    if (filters.desde || filters.hasta) {
      const fechaCreacion: Record<string, Date> = {};
      if (filters.desde) fechaCreacion['gte'] = new Date(filters.desde);
      if (filters.hasta) fechaCreacion['lte'] = new Date(filters.hasta);
      where['fechaCreacion'] = fechaCreacion;
    }

    return this.prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { id: true, razonSocial: true } },
        _count: { select: { detalles: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async findConfirmedBySku(fecha: string) {
    const day = new Date(fecha);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const detalles = await this.prisma.detallePedido.findMany({
      where: {
        pedido: {
          estado: OrderStatus.CONFIRMED,
          fechaEntrega: { gte: day, lt: nextDay },
        },
      },
      include: {
        producto: { select: PRODUCTO_SELECT },
      },
    });

    const grouped = new Map<
      number,
      { producto: (typeof detalles)[0]['producto']; totalCantidad: number }
    >();

    for (const detalle of detalles) {
      const existing = grouped.get(detalle.productoId);
      if (existing) {
        existing.totalCantidad += detalle.cantidad.toNumber();
      } else {
        grouped.set(detalle.productoId, {
          producto: detalle.producto,
          totalCantidad: detalle.cantidad.toNumber(),
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.producto.nombre.localeCompare(b.producto.nombre),
    );
  }
}
