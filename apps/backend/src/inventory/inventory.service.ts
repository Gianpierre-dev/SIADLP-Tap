import { Injectable } from '@nestjs/common';
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
}
