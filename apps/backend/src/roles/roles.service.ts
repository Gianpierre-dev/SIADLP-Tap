import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.rol.findFirst({
      where: { nombre: dto.nombre },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe un rol con el nombre "${dto.nombre}"`,
      );
    }

    return this.prisma.rol.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        permisos: {
          create: dto.permisoIds.map((permisoId) => ({ permisoId })),
        },
      },
      include: {
        permisos: {
          include: { permiso: true },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.rol.findMany({
      where: { activo: true },
      include: {
        permisos: {
          include: { permiso: true },
        },
        _count: {
          select: { usuarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: number) {
    const rol = await this.prisma.rol.findUnique({
      where: { id },
      include: {
        permisos: {
          include: { permiso: true },
        },
        _count: {
          select: { usuarios: true },
        },
      },
    });

    if (!rol) {
      throw new NotFoundException(`Rol con id ${id} no encontrado`);
    }

    return rol;
  }

  async findAllPermissions() {
    return this.prisma.permiso.findMany({
      orderBy: [{ modulo: 'asc' }, { accion: 'asc' }],
    });
  }

  async update(id: number, dto: UpdateRoleDto) {
    await this.findOne(id);

    const { permisoIds, ...rolData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (permisoIds !== undefined) {
        await tx.rolPermiso.deleteMany({ where: { rolId: id } });

        if (permisoIds.length > 0) {
          await tx.rolPermiso.createMany({
            data: permisoIds.map((permisoId) => ({ rolId: id, permisoId })),
          });
        }
      }

      return tx.rol.update({
        where: { id },
        data: rolData,
        include: {
          permisos: {
            include: { permiso: true },
          },
          _count: {
            select: { usuarios: true },
          },
        },
      });
    });
  }
}
