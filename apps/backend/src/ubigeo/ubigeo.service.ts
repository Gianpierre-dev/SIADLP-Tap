import { Injectable } from '@nestjs/common';
import type { Departamento, Distrito, Provincia } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UbigeoService {
  constructor(private readonly prisma: PrismaService) {}

  findDepartamentos(): Promise<Departamento[]> {
    return this.prisma.departamento.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  findProvincias(departamentoId: string): Promise<Provincia[]> {
    return this.prisma.provincia.findMany({
      where: { departamentoId },
      orderBy: { nombre: 'asc' },
    });
  }

  findDistritos(provinciaId: string): Promise<Distrito[]> {
    return this.prisma.distrito.findMany({
      where: { provinciaId },
      orderBy: { nombre: 'asc' },
    });
  }
}
