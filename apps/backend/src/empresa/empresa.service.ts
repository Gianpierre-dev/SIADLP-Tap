import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne() {
    const empresa = await this.prisma.empresa.findUnique({ where: { id: 1 } });
    if (!empresa) {
      throw new NotFoundException('Configuración de empresa no encontrada');
    }
    return empresa;
  }

  async update(dto: UpdateEmpresaDto) {
    return this.prisma.empresa.update({
      where: { id: 1 },
      data: dto,
    });
  }

  async updateLogo(logoUrl: string) {
    return this.prisma.empresa.update({
      where: { id: 1 },
      data: { logoUrl },
    });
  }
}
