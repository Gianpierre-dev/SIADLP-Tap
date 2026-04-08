import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const existing = await this.prisma.producto.findUnique({
      where: { codigoSku: dto.codigoSku },
    });

    if (existing) {
      throw new ConflictException(`El SKU ${dto.codigoSku} ya está registrado`);
    }

    return this.prisma.producto.create({ data: dto });
  }

  async findAll() {
    return this.prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });

    if (!producto) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }

    return producto;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.codigoSku) {
      const existing = await this.prisma.producto.findFirst({
        where: { codigoSku: dto.codigoSku, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`El SKU ${dto.codigoSku} ya está en uso`);
      }
    }

    return this.prisma.producto.update({ where: { id }, data: dto });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.producto.update({
      where: { id },
      data: { activo: false },
    });
  }
}
