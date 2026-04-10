import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UbigeoService {
  constructor(private readonly prisma: PrismaService) {}

  async findDepartamentos() {
    return this.prisma.departamento.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async findProvincias(departamentoId: string) {
    return this.prisma.provincia.findMany({
      where: { departamentoId },
      orderBy: { nombre: 'asc' },
    });
  }

  async findDistritos(provinciaId: string) {
    return this.prisma.distrito.findMany({
      where: { provinciaId },
      orderBy: { nombre: 'asc' },
    });
  }
}
