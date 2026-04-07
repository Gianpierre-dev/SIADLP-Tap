import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { canTransitionOc, OcStatus } from '@siadlp/shared';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ChangeOcStatusDto } from './dto/change-oc-status.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';

const PROVEEDOR_SELECT = {
  id: true,
  razonSocial: true,
} as const;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreatePurchaseDto, userId: number) {
    const lineas = dto.detalles.map((line) => {
      const subtotal = line.precioUnitario * line.cantidad;
      return {
        descripcion: line.descripcion,
        unidadMedida: line.unidadMedida,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        subtotal,
      };
    });

    const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

    return this.prisma.$transaction(async (tx) => {
      return tx.ordenCompra.create({
        data: {
          proveedorId: dto.proveedorId,
          observacion: dto.observacion,
          total,
          creadoPorId: userId,
          detalles: {
            create: lineas.map((l) => ({
              descripcion: l.descripcion,
              unidadMedida: l.unidadMedida,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              subtotal: l.subtotal,
            })),
          },
        },
        include: {
          detalles: true,
          proveedor: { select: PROVEEDOR_SELECT },
        },
      });
    });
  }

  async findAll(filters?: { estado?: string; proveedorId?: number }) {
    const where: Record<string, unknown> = {};

    if (filters?.estado) {
      where['estado'] = filters.estado;
    }

    if (filters?.proveedorId) {
      where['proveedorId'] = filters.proveedorId;
    }

    return this.prisma.ordenCompra.findMany({
      where,
      include: {
        proveedor: { select: PROVEEDOR_SELECT },
        _count: { select: { detalles: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async findOne(id: number) {
    const oc = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: {
        detalles: true,
        proveedor: { select: PROVEEDOR_SELECT },
      },
    });

    if (!oc) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    return oc;
  }

  async changeStatus(id: number, dto: ChangeOcStatusDto, userId: number) {
    const oc = await this.prisma.ordenCompra.findUnique({ where: { id } });

    if (!oc) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    const currentStatus = oc.estado as OcStatus;
    const newStatus = dto.nuevoEstado as OcStatus;

    if (newStatus === OcStatus.RECIBIDA) {
      throw new BadRequestException(
        'La transición a RECIBIDA solo se puede hacer mediante el endpoint de recepción',
      );
    }

    if (!canTransitionOc(currentStatus, newStatus)) {
      throw new BadRequestException(
        `No se puede transicionar de ${currentStatus} a ${newStatus}`,
      );
    }

    return this.prisma.ordenCompra.update({
      where: { id },
      data: { estado: newStatus },
      include: {
        detalles: true,
        proveedor: { select: PROVEEDOR_SELECT },
      },
    });
  }

  async receive(id: number, dto: ReceivePurchaseDto, userId: number) {
    const oc = await this.prisma.ordenCompra.findUnique({
      where: { id },
      include: { detalles: true },
    });

    if (!oc) {
      throw new NotFoundException(`Orden de compra con id ${id} no encontrada`);
    }

    if (oc.estado !== OcStatus.EN_CAMINO) {
      throw new BadRequestException(
        `Solo se pueden recibir órdenes en estado EN_CAMINO. Estado actual: ${oc.estado}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const linea of dto.lineas) {
        await tx.detalleOrdenCompra.update({
          where: { id: linea.detalleId },
          data: { cantidadRecibida: linea.cantidadRecibida },
        });
      }

      const updated = await tx.ordenCompra.update({
        where: { id },
        data: { estado: OcStatus.RECIBIDA },
        include: {
          detalles: true,
          proveedor: { select: PROVEEDOR_SELECT },
        },
      });

      const items = dto.lineas.map((linea) => {
        const detalle = oc.detalles.find((d) => d.id === linea.detalleId);
        return {
          nombre: detalle?.descripcion ?? `Detalle ${linea.detalleId}`,
          unidadMedida: detalle?.unidadMedida ?? 'unidad',
          cantidad: linea.cantidadRecibida,
        };
      });

      await this.inventoryService.registerPurchaseEntry(
        tx,
        items,
        `OC-${id}`,
        userId,
      );

      return updated;
    });
  }

  async findHistory(filters: {
    estado?: string;
    proveedorId?: number;
    desde?: string;
    hasta?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.estado) {
      where['estado'] = filters.estado;
    }

    if (filters.proveedorId) {
      where['proveedorId'] = filters.proveedorId;
    }

    if (filters.desde || filters.hasta) {
      const fechaCreacion: Record<string, Date> = {};
      if (filters.desde) fechaCreacion['gte'] = new Date(filters.desde);
      if (filters.hasta) fechaCreacion['lte'] = new Date(filters.hasta);
      where['fechaCreacion'] = fechaCreacion;
    }

    return this.prisma.ordenCompra.findMany({
      where,
      include: {
        proveedor: { select: PROVEEDOR_SELECT },
        _count: { select: { detalles: true } },
      },
      orderBy: { fechaCreacion: 'desc' },
    });
  }
}
