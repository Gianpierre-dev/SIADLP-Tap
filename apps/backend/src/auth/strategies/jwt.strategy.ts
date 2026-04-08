import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<{ id: number; correo: string; rolId: number }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no válido o inactivo');
    }

    if (usuario.rolId !== payload.rolId) {
      throw new UnauthorizedException(
        'Sesión inválida. Los permisos han cambiado.',
      );
    }

    return { id: usuario.id, correo: usuario.correo, rolId: usuario.rolId };
  }
}
