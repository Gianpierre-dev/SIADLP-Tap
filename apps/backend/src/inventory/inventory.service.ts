import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, InventoryType } from '@siadlp/shared';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { UpdateMinStockDto } from './dto/update-min-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async registerPurchaseEntry(
    tx: Prisma.TransactionClient,
    items: Array<{ nombre: string; unidadMedida: string; cantidad: number }>,
    referencia: string,
    usuarioId: number,
  ): Promise<void> {
    for (const item of items) {
      let inventoryItem = await tx.itemInventario.findFirst({
        where: { tipo: InventoryType.MATERIA_PRIMA, nombre: item.nombre },
      });

      if (!inventoryItem) {
        inventoryItem = await tx.itemInventario.create({
          data: {
            tipo: InventoryType.MATERIA_PRIMA,
            nombre: item.nombre,
            unidadMedida: item.unidadMedida,
            stockActual: 0,
          },
        });
      }

      const nuevoStock = inventoryItem.stockActual.toNumber() + item.cantidad;

      await tx.itemInventario.update({
        where: { id: inventoryItem.id },
        data: { stockActual: nuevoStock },
      });

      await tx.movimientoInventario.create({
        data: {
          itemInventarioId: inventoryItem.id,
          tipo: MovementType.COMPRA_ENTRADA,
          cantidad: item.cantidad,
          stockResultante: nuevoStock,
          referencia,
          usuarioId,
        },
      });
    }
  }

  async registerMovement(
    tx: Prisma.TransactionClient,
    itemInventarioId: number,
    tipo: string,
    cantidad: number,
    referencia: string,
    usuarioId: number,
  ): Promise<void> {
    const isExit =
      tipo === MovementType.PRODUCCION_SALIDA ||
      tipo === MovementType.DESPACHO_SALIDA ||
      tipo === MovementType.AJUSTE_NEGATIVO;

    const delta = isExit ? -cantidad : cantidad;

    // Atomic update with constraint check to prevent race conditions
    if (isExit) {
      const updated = await tx.itemInventario.updateMany({
        where: {
          id: itemInventarioId,
          stockActual: { gte: cantidad },
        },
        data: {
          stockActual: { increment: delta },
        },
      });

      if (updated.count === 0) {
        const item = await tx.itemInventario.findUnique({
          where: { id: itemInventarioId },
        });
        if (!item)
          throw new NotFoundException('Item de inventario no encontrado');
        throw new BadRequestException(
          `Stock insuficiente para ${item.nombre}. Disponible: ${item.stockActual.toNumber()}, requerido: ${cantidad}`,
        );
      }
    } else {
      const updated = await tx.itemInventario.updateMany({
        where: { id: itemInventarioId },
        data: { stockActual: { increment: delta } },
      });

      if (updated.count === 0) {
        throw new NotFoundException('Item de inventario no encontrado');
      }
    }

    // Read the updated stock for the movement log
    const item = await tx.itemInventario.findUniqueOrThrow({
      where: { id: itemInventarioId },
    });

    await tx.movimientoInventario.create({
      data: {
        itemInventarioId,
        tipo,
        cantidad,
        stockResultante: item.stockActual,
        referencia,
        usuarioId,
      },
    });
  }

  async findOrCreatePtItem(
    tx: Prisma.TransactionClient,
    nombre: string,
    unidadMedida: string,
  ): Promise<number> {
    let item = await tx.itemInventario.findFirst({
      where: { tipo: InventoryType.PRODUCTO_TERMINADO, nombre },
    });

    if (!item) {
      item = await tx.itemInventario.create({
        data: {
          tipo: InventoryType.PRODUCTO_TERMINADO,
          nombre,
          unidadMedida,
          stockActual: 0,
        },
      });
    }

    return item.id;
  }

  async getStockMp() {
    return this.prisma.itemInventario.findMany({
      where: { tipo: InventoryType.MATERIA_PRIMA, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getStockPt() {
    return this.prisma.itemInventario.findMany({
      where: { tipo: InventoryType.PRODUCTO_TERMINADO, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getKardex(
    itemId: number,
    filters?: { desde?: string; hasta?: string },
  ) {
    const where: Record<string, unknown> = { itemInventarioId: itemId };

    if (filters?.desde || filters?.hasta) {
      const fechaFilter: Record<string, Date> = {};
      if (filters.desde) fechaFilter.gte = new Date(filters.desde);
      if (filters.hasta) fechaFilter.lte = new Date(filters.hasta);
      where.fechaCreacion = fechaFilter;
    }

    return this.prisma.movimientoInventario.findMany({
      where,
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { fechaCreacion: 'desc' },
    });
  }

  async getAlerts() {
    const items = await this.prisma.itemInventario.findMany({
      where: { activo: true },
    });

    return items.filter(
      (item) =>
        item.stockMinimo.toNumber() > 0 &&
        item.stockActual.toNumber() <= item.stockMinimo.toNumber(),
    );
  }

  async adjustStock(itemId: number, dto: AdjustInventoryDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemInventario.findUnique({
        where: { id: itemId },
      });
      if (!item) throw new NotFoundException('Item no encontrado');

      const tipo =
        dto.cantidad >= 0
          ? MovementType.AJUSTE_POSITIVO
          : MovementType.AJUSTE_NEGATIVO;
      const cantidadAbsoluta = Math.abs(dto.cantidad);
      const nuevoStock =
        dto.cantidad >= 0
          ? item.stockActual.toNumber() + cantidadAbsoluta
          : item.stockActual.toNumber() - cantidadAbsoluta;

      if (nuevoStock < 0) {
        throw new BadRequestException('El ajuste dejaría el stock en negativo');
      }

      await tx.itemInventario.update({
        where: { id: itemId },
        data: { stockActual: nuevoStock },
      });

      await tx.movimientoInventario.create({
        data: {
          itemInventarioId: itemId,
          tipo,
          cantidad: cantidadAbsoluta,
          stockResultante: nuevoStock,
          referencia: `AJUSTE: ${dto.motivo}`,
          usuarioId: userId,
        },
      });

      return tx.itemInventario.findUnique({ where: { id: itemId } });
    });
  }

  async updateMinStock(itemId: number, dto: UpdateMinStockDto) {
    const item = await this.prisma.itemInventario.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item no encontrado');

    return this.prisma.itemInventario.update({
      where: { id: itemId },
      data: { stockMinimo: dto.stockMinimo },
    });
  }
}
