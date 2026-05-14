import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface LoginResponse {
  accessToken: string;
  usuario: {
    id: number;
    correo: string;
    nombre: string;
    permisos: string[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @InjectPinoLogger(AuthService.name)
    private readonly logger: PinoLogger,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: dto.correo },
      include: {
        rol: {
          include: {
            permisos: {
              include: { permiso: true },
            },
          },
        },
      },
    });

    if (!usuario) {
      // Log con `correo` pero NUNCA con la contraseña — pino redacta `contrasena`
      // a nivel global, pero ni siquiera la pasamos al log para defense in depth.
      this.logger.warn(
        { correo: dto.correo, reason: 'user_not_found' },
        'login.failed',
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.activo) {
      this.logger.warn(
        { correo: dto.correo, userId: usuario.id, reason: 'user_inactive' },
        'login.failed',
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const contrasenaValida = await bcrypt.compare(
      dto.contrasena,
      usuario.contrasena,
    );

    if (!contrasenaValida) {
      this.logger.warn(
        { correo: dto.correo, userId: usuario.id, reason: 'invalid_password' },
        'login.failed',
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      correo: usuario.correo,
      rolId: usuario.rolId,
    };

    const permisos = usuario.rol.permisos.map(
      (rp) => `${rp.permiso.modulo}.${rp.permiso.accion}`,
    );

    this.logger.info(
      {
        userId: usuario.id,
        correo: usuario.correo,
        permisosCount: permisos.length,
      },
      'login.success',
    );

    return {
      accessToken: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        nombre: usuario.nombre,
        permisos,
      },
    };
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const contrasenaValida = await bcrypt.compare(
      dto.contrasenaActual,
      usuario.contrasena,
    );

    if (!contrasenaValida) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const contrasenaHash = await bcrypt.hash(dto.contrasenaNueva, 12);

    await this.prisma.usuario.update({
      where: { id: userId },
      data: { contrasena: contrasenaHash },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
