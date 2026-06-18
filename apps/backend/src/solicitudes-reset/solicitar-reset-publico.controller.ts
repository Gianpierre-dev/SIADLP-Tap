import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { SolicitudesResetService } from './solicitudes-reset.service';
import { CrearSolicitudResetDto } from './dto/crear-solicitud.dto';

@Controller('auth')
export class SolicitarResetPublicoController {
  constructor(private readonly service: SolicitudesResetService) {}

  @Public()
  @Throttle({ short: { ttl: 60_000, limit: 5 } })
  @Post('solicitar-reset')
  @HttpCode(200)
  async solicitar(@Body() dto: CrearSolicitudResetDto) {
    await this.service.crear(dto);
    return {
      message:
        'Si el correo esta registrado, un administrador procesara tu solicitud.',
    };
  }
}
