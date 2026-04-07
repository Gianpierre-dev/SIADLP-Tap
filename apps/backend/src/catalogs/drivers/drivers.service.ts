import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDriverDto) {
    const existing = await this.prisma.chofer.findUnique({
      where: { dni: dto.dni },
    });

    if (existing) {
      throw new ConflictException(`El DNI "${dto.dni}" ya está registrado`);
    }

    return this.prisma.chofer.create({ data: dto });
  }

  async findAll() {
    return this.prisma.chofer.findMany({
      where: { activo: true },
      orderBy: { apellido: 'asc' },
    });
  }

  async findOne(id: number) {
    const chofer = await this.prisma.chofer.findUnique({ where: { id } });

    if (!chofer) {
      throw new NotFoundException(`Chofer con id ${id} no encontrado`);
    }

    return chofer;
  }

  async update(id: number, dto: UpdateDriverDto) {
    await this.findOne(id);

    if (dto.dni) {
      const existing = await this.prisma.chofer.findFirst({
        where: { dni: dto.dni, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`El DNI "${dto.dni}" ya está en uso`);
      }
    }

    return this.prisma.chofer.update({ where: { id }, data: dto });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.chofer.update({
      where: { id },
      data: { activo: false },
    });
  }
}
