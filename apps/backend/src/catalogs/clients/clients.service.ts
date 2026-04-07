import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const RUTA_SELECT = {
  id: true,
  nombre: true,
  tarifa: true,
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    if (dto.ruc) {
      const existing = await this.prisma.cliente.findUnique({
        where: { ruc: dto.ruc },
      });

      if (existing) {
        throw new ConflictException(`El RUC ${dto.ruc} ya está registrado`);
      }
    }

    return this.prisma.cliente.create({
      data: dto,
      include: { ruta: { select: RUTA_SELECT } },
    });
  }

  async findAll() {
    return this.prisma.cliente.findMany({
      where: { activo: true },
      include: { ruta: { select: RUTA_SELECT } },
      orderBy: { razonSocial: 'asc' },
    });
  }

  async findOne(id: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: { ruta: { select: RUTA_SELECT } },
    });

    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }

    return cliente;
  }

  async update(id: number, dto: UpdateClientDto) {
    await this.findOne(id);

    if (dto.ruc) {
      const existing = await this.prisma.cliente.findFirst({
        where: { ruc: dto.ruc, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`El RUC ${dto.ruc} ya está en uso`);
      }
    }

    return this.prisma.cliente.update({
      where: { id },
      data: dto,
      include: { ruta: { select: RUTA_SELECT } },
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
      include: { ruta: { select: RUTA_SELECT } },
    });
  }
}
