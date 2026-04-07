import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { ProductionStatus, MovementType } from '@siadlp/shared';
import { CreateProductionDto } from './dto/create-production.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';

interface ProductionMetrics {
  totalMpKg: number;
  totalPtKg: number;
  rendimiento: number;
  mermaKg: number;
  mermaPct: number;
  costoTotalMp: number;
  costoRealPorKg: number;
}

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateProductionDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      return tx.ordenProduccion.create({
        data: {
          fecha: new Date(dto.fecha),
          observacion: dto.observacion,
          estado: ProductionStatus.PENDIENTE,
          creadoPorId: userId,
          insumos: {
            create: dto.insumos.map((insumo) => ({
              itemInventarioId: insumo.itemInventarioId,
              cantidad: insumo.cantidad,
              costoUnitario: insumo.costoUnitario,
              costoTotal: insumo.cantidad * insumo.costoUnitario,
            })),
          },
        },
        include: {
          insumos: {
            include: {
              itemInventario: { select: { id: true, nombre: true, unidadMedida: true } },
            },
          },
          creadoPor: { select: { id: true, nombre: true } },
        },
      });
    });
  }

  async complete(id: number, dto: CompleteProductionDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.findUnique({
        where: { id },
        include: { insumos: true },
      });

      if (!orden) {
        throw new NotFoundException(`Orden de producción con id ${id} no encontrada`);
      }

      if (orden.estado !== ProductionStatus.PENDIENTE) {
        throw new BadRequestException(
          `Solo se pueden completar órdenes en estado PENDIENTE. Estado actual: ${orden.estado}`,
        );
      }

      // Update estado to COMPLETADA
      await tx.ordenProduccion.update({
        where: { id },
        data: { estado: ProductionStatus.COMPLETADA },
      });

      // Create ProductoProduccion records
      await tx.productoProduccion.createMany({
        data: dto.productos.map((p) => ({
          ordenProduccionId: id,
          productoId: p.productoId,
          cantidad: p.cantidad,
        })),
      });

      const referencia = `OP-${id}`;

      // Decrease MP stock for each insumo
      for (const insumo of orden.insumos) {
        await this.inventoryService.registerMovement(
          tx,
          insumo.itemInventarioId,
          MovementType.PRODUCCION_SALIDA,
          insumo.cantidad.toNumber(),
          referencia,
          userId,
        );
      }

      // Increase PT stock for each output product
      for (const output of dto.productos) {
        const producto = await tx.producto.findUnique({
          where: { id: output.productoId },
          select: { nombre: true, unidadMedida: true },
        });

        if (!producto) {
          throw new NotFoundException(`Producto con id ${output.productoId} no encontrado`);
        }

        const ptItemId = await this.inventoryService.findOrCreatePtItem(
          tx,
          producto.nombre,
          producto.unidadMedida,
        );

        await this.inventoryService.registerMovement(
          tx,
          ptItemId,
          MovementType.PRODUCCION_ENTRADA,
          output.cantidad,
          referencia,
          userId,
        );
      }

      // Calculate metrics
      const totalMpKg = orden.insumos.reduce(
        (acc, insumo) => acc + insumo.cantidad.toNumber(),
        0,
      );
      const totalPtKg = dto.productos.reduce((acc, p) => acc + p.cantidad, 0);
      const rendimiento = totalMpKg > 0 ? (totalPtKg / totalMpKg) * 100 : 0;
      const mermaKg = totalMpKg - totalPtKg;
      const mermaPct = totalMpKg > 0 ? (mermaKg / totalMpKg) * 100 : 0;
      const costoTotalMp = orden.insumos.reduce(
        (acc, insumo) => acc + insumo.costoTotal.toNumber(),
        0,
      );
      const costoRealPorKg = totalPtKg > 0 ? costoTotalMp / totalPtKg : 0;

      const metrics: ProductionMetrics = {
        totalMpKg,
        totalPtKg,
        rendimiento,
        mermaKg,
        mermaPct,
        costoTotalMp,
        costoRealPorKg,
      };

      const updatedOrden = await tx.ordenProduccion.findUnique({
        where: { id },
        include: {
          insumos: {
            include: {
              itemInventario: { select: { id: true, nombre: true, unidadMedida: true } },
            },
          },
          productos: {
            include: {
              producto: { select: { id: true, nombre: true, unidadMedida: true } },
            },
          },
          creadoPor: { select: { id: true, nombre: true } },
        },
      });

      return { ...updatedOrden, metrics };
    });
  }

  async findAll() {
    return this.prisma.ordenProduccion.findMany({
      include: {
        _count: {
          select: { insumos: true, productos: true },
        },
        creadoPor: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: number) {
    const orden = await this.prisma.ordenProduccion.findUnique({
      where: { id },
      include: {
        insumos: {
          include: {
            itemInventario: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
        productos: {
          include: {
            producto: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
        creadoPor: { select: { id: true, nombre: true } },
      },
    });

    if (!orden) {
      throw new NotFoundException(`Orden de producción con id ${id} no encontrada`);
    }

    if (orden.estado === ProductionStatus.COMPLETADA) {
      const totalMpKg = orden.insumos.reduce(
        (acc, insumo) => acc + insumo.cantidad.toNumber(),
        0,
      );
      const totalPtKg = orden.productos.reduce(
        (acc, p) => acc + p.cantidad.toNumber(),
        0,
      );
      const rendimiento = totalMpKg > 0 ? (totalPtKg / totalMpKg) * 100 : 0;
      const mermaKg = totalMpKg - totalPtKg;
      const mermaPct = totalMpKg > 0 ? (mermaKg / totalMpKg) * 100 : 0;
      const costoTotalMp = orden.insumos.reduce(
        (acc, insumo) => acc + insumo.costoTotal.toNumber(),
        0,
      );
      const costoRealPorKg = totalPtKg > 0 ? costoTotalMp / totalPtKg : 0;

      const metrics: ProductionMetrics = {
        totalMpKg,
        totalPtKg,
        rendimiento,
        mermaKg,
        mermaPct,
        costoTotalMp,
        costoRealPorKg,
      };

      return { ...orden, metrics };
    }

    return orden;
  }

  async findMonthSummary(year: number, month: number) {
    const desde = new Date(year, month - 1, 1);
    const hasta = new Date(year, month, 1);

    const ordenes = await this.prisma.ordenProduccion.findMany({
      where: {
        estado: ProductionStatus.COMPLETADA,
        fecha: { gte: desde, lt: hasta },
      },
      include: {
        insumos: true,
        productos: true,
      },
    });

    const totalBatches = ordenes.length;

    const totalPtKg = ordenes.reduce((acc, orden) => {
      return acc + orden.productos.reduce((sum, p) => sum + p.cantidad.toNumber(), 0);
    }, 0);

    const rendimientos = ordenes.map((orden) => {
      const mpKg = orden.insumos.reduce((sum, i) => sum + i.cantidad.toNumber(), 0);
      const ptKg = orden.productos.reduce((sum, p) => sum + p.cantidad.toNumber(), 0);
      return mpKg > 0 ? (ptKg / mpKg) * 100 : 0;
    });

    const promedioRendimiento =
      rendimientos.length > 0
        ? rendimientos.reduce((acc, r) => acc + r, 0) / rendimientos.length
        : 0;

    const totalMermaKg = ordenes.reduce((acc, orden) => {
      const mpKg = orden.insumos.reduce((sum, i) => sum + i.cantidad.toNumber(), 0);
      const ptKg = orden.productos.reduce((sum, p) => sum + p.cantidad.toNumber(), 0);
      return acc + (mpKg - ptKg);
    }, 0);

    return {
      year,
      month,
      totalBatches,
      totalPtKg,
      promedioRendimiento,
      totalMermaKg,
    };
  }
}
