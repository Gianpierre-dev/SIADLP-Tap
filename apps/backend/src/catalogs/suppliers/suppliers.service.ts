import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    if (dto.ruc) {
      const existing = await this.prisma.proveedor.findUnique({
        where: { ruc: dto.ruc },
      });

      if (existing) {
        throw new ConflictException(`El RUC ${dto.ruc} ya está registrado`);
      }
    }

    return this.prisma.proveedor.create({ data: dto });
  }

  async findAll() {
    return this.prisma.proveedor.findMany({
      where: { activo: true },
      orderBy: { razonSocial: 'asc' },
    });
  }

  async findOne(id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id },
    });

    if (!proveedor) {
      throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
    }

    return proveedor;
  }

  async update(id: number, dto: UpdateSupplierDto) {
    await this.findOne(id);

    if (dto.ruc) {
      const existing = await this.prisma.proveedor.findFirst({
        where: { ruc: dto.ruc, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`El RUC ${dto.ruc} ya está en uso`);
      }
    }

    return this.prisma.proveedor.update({ where: { id }, data: dto });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.proveedor.update({
      where: { id },
      data: { activo: false },
    });
  }
}
