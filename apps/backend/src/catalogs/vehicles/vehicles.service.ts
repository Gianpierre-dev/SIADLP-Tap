import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVehicleDto) {
    const existing = await this.prisma.vehiculo.findUnique({
      where: { placa: dto.placa },
    });

    if (existing) {
      throw new ConflictException(`La placa "${dto.placa}" ya está registrada`);
    }

    return this.prisma.vehiculo.create({ data: dto });
  }

  async findAll() {
    return this.prisma.vehiculo.findMany({
      where: { activo: true },
      orderBy: { placa: 'asc' },
    });
  }

  async findOne(id: number) {
    const vehiculo = await this.prisma.vehiculo.findUnique({ where: { id } });

    if (!vehiculo) {
      throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
    }

    return vehiculo;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    await this.findOne(id);

    if (dto.placa) {
      const existing = await this.prisma.vehiculo.findFirst({
        where: { placa: dto.placa, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`La placa "${dto.placa}" ya está en uso`);
      }
    }

    return this.prisma.vehiculo.update({ where: { id }, data: dto });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.vehiculo.update({
      where: { id },
      data: { activo: false },
    });
  }
}
