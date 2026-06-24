import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const RUTA_SELECT = {
  id: true,
  nombre: true,
  zona: true,
} as const;

const UBIGEO_INCLUDE = {
  ruta: { select: RUTA_SELECT },
  departamento: { select: { id: true, nombre: true } },
  provincia: { select: { id: true, nombre: true } },
  distrito: { select: { id: true, nombre: true } },
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

    // Validate FKs explicitly to return user-friendly errors instead of P2003
    const ruta = await this.prisma.ruta.findUnique({
      where: { id: dto.rutaId },
    });
    if (!ruta || !ruta.activa) {
      throw new BadRequestException('Ruta no encontrada o inactiva');
    }

    if (dto.departamentoId) {
      const departamento = await this.prisma.departamento.findUnique({
        where: { id: dto.departamentoId },
      });
      if (!departamento) {
        throw new BadRequestException('Departamento no encontrado');
      }
    }

    if (dto.provinciaId) {
      const provincia = await this.prisma.provincia.findUnique({
        where: { id: dto.provinciaId },
      });
      if (!provincia) {
        throw new BadRequestException('Provincia no encontrada');
      }
    }

    if (dto.distritoId) {
      const distrito = await this.prisma.distrito.findUnique({
        where: { id: dto.distritoId },
      });
      if (!distrito) {
        throw new BadRequestException('Distrito no encontrado');
      }
    }

    return this.prisma.cliente.create({
      data: dto,
      include: UBIGEO_INCLUDE,
    });
  }

  async findAll(incluirInactivos?: boolean) {
    return this.prisma.cliente.findMany({
      where: incluirInactivos ? {} : { activo: true },
      include: UBIGEO_INCLUDE,
      orderBy: { razonSocial: 'asc' },
    });
  }

  async findOne(id: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: UBIGEO_INCLUDE,
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
      include: UBIGEO_INCLUDE,
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.cliente.update({
      where: { id },
      data: { activo: false },
      include: UBIGEO_INCLUDE,
    });
  }

  async reactivate(id: number) {
    await this.findOne(id);

    return this.prisma.cliente.update({
      where: { id },
      data: { activo: true },
      include: UBIGEO_INCLUDE,
    });
  }
}
