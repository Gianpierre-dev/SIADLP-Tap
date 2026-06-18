import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

function generarContrasenaTemporal(): string {
  const random = randomBytes(6).toString('base64url');
  return `Temp${random}1!`;
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
    });

    if (existing) {
      throw new ConflictException(`El correo ${dto.correo} ya está registrado`);
    }

    const contrasenaHash = await bcrypt.hash(dto.contrasena, 12);

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
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async update(id: number, dto: UpdateUserDto, currentUserId: number) {
    await this.findOne(id);

    if (dto.rolId !== undefined && id === currentUserId) {
      throw new ForbiddenException('No puede cambiar su propio rol');
    }

    if (dto.rolId !== undefined) {
      const rol = await this.prisma.rol.findUnique({
        where: { id: dto.rolId },
      });
      if (!rol || !rol.activo) {
        throw new BadRequestException(
          `Rol con id ${dto.rolId} no existe o está inactivo`,
        );
      }
    }

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
      data: {
        ...(dto.correo && { correo: dto.correo }),
        ...(dto.nombre && { nombre: dto.nombre }),
        ...(dto.rolId !== undefined && { rolId: dto.rolId }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
      },
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

  async resetPassword(
    targetUserId: number,
    currentUserId: number,
  ): Promise<{ contrasenaTemporal: string }> {
    const target = await this.prisma.usuario.findUnique({
      where: { id: targetUserId },
      select: { id: true, correo: true, activo: true },
    });

    if (!target) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!target.activo) {
      throw new BadRequestException(
        'No se puede resetear la contrasena de un usuario inactivo',
      );
    }

    const contrasenaTemporal = generarContrasenaTemporal();
    const contrasenaHash = await bcrypt.hash(contrasenaTemporal, 12);

    await this.prisma.usuario.update({
      where: { id: targetUserId },
      data: {
        contrasena: contrasenaHash,
        debeCambiarContrasena: true,
      },
    });

    await this.audit.log({
      usuarioId: currentUserId,
      accion: 'reset_password',
      modulo: 'usuarios',
      entidadId: targetUserId,
      detalle: `Reset de contrasena para ${target.correo}`,
    });

    return { contrasenaTemporal };
  }
}
