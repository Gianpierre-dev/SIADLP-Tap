import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  correo: true,
  nombre: true,
  activo: true,
  rolId: true,
  rol: { select: { nombre: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (existing) {
      throw new ConflictException(`El correo ${dto.correo} ya está registrado`);
    }

    const contrasenaHash = await bcrypt.hash(dto.contrasena, 10);

    return this.prisma.usuario.create({
      data: {
        correo: dto.correo,
        contrasena: contrasenaHash,
        nombre: dto.nombre,
        rolId: dto.rolId,
      },
      select: USER_SELECT,
    });
  }

  async findAll() {
    return this.prisma.usuario.findMany({
      where: { activo: true },
      select: USER_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }

    return usuario;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.correo) {
      const existing = await this.prisma.usuario.findFirst({
        where: { correo: dto.correo, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`El correo ${dto.correo} ya está en uso`);
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async deactivate(id: number) {
    await this.findOne(id);

    return this.prisma.usuario.update({
      where: { id },
      data: { activo: false },
      select: USER_SELECT,
    });
  }
}
