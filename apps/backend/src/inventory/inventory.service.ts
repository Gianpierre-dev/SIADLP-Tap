import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, InventoryType } from '@siadlp/shared';

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
    const item = await tx.itemInventario.findUnique({ where: { id: itemInventarioId } });
    if (!item) throw new NotFoundException(`Item de inventario ${itemInventarioId} no encontrado`);

    const isExit =
      tipo === MovementType.PRODUCCION_SALIDA ||
      tipo === MovementType.DESPACHO_SALIDA ||
      tipo === MovementType.AJUSTE_NEGATIVO;

    const nuevoStock = isExit
      ? item.stockActual.toNumber() - cantidad
      : item.stockActual.toNumber() + cantidad;

    if (nuevoStock < 0) {
      throw new BadRequestException(
        `Stock insuficiente para ${item.nombre}. Disponible: ${item.stockActual}, requerido: ${cantidad}`,
      );
    }

    await tx.itemInventario.update({
      where: { id: itemInventarioId },
      data: { stockActual: nuevoStock },
    });

    await tx.movimientoInventario.create({
      data: { itemInventarioId, tipo, cantidad, stockResultante: nuevoStock, referencia, usuarioId },
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
}
