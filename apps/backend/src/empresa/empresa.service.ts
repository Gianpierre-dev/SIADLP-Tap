import { Injectable, NotFoundException } from '@nestjs/common';
import type { Empresa } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(): Promise<Empresa> {
    const empresa: Empresa | null = await this.prisma.empresa.findUnique({
      where: { id: 1 },
    });
    if (!empresa) {
      throw new NotFoundException('Configuración de empresa no encontrada');
    }
    return empresa;
  }

  update(dto: UpdateEmpresaDto): Promise<Empresa> {
    return this.prisma.empresa.update({
      where: { id: 1 },
      data: dto,
    });
  }

  updateLogo(logoUrl: string): Promise<Empresa> {
    return this.prisma.empresa.update({
      where: { id: 1 },
      data: { logoUrl },
    });
  }
}
