import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRouteDto) {
    const existing = await this.prisma.ruta.findUnique({
      where: { nombre: dto.nombre },
    });

    if (existing) {
      throw new ConflictException(`La ruta "${dto.nombre}" ya está registrada`);
    }

    return this.prisma.ruta.create({ data: dto });
  }

  async findAll() {
    return this.prisma.ruta.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { clientes: true } },
      },
    });
  }

  async findOne(id: number) {
    const ruta = await this.prisma.ruta.findUnique({
      where: { id },
      include: {
        _count: { select: { clientes: true } },
      },
    });

    if (!ruta) {
      throw new NotFoundException(`Ruta con id ${id} no encontrada`);
    }

    return ruta;
  }

  async update(id: number, dto: UpdateRouteDto) {
    await this.findOne(id);

    if (dto.nombre) {
      const existing = await this.prisma.ruta.findFirst({
        where: { nombre: dto.nombre, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`El nombre "${dto.nombre}" ya está en uso`);
      }
    }

    return this.prisma.ruta.update({
      where: { id },
      data: dto,
      include: {
        _count: { select: { clientes: true } },
      },
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.ruta.update({
      where: { id },
      data: { activa: false },
      include: {
        _count: { select: { clientes: true } },
      },
    });
  }
}
