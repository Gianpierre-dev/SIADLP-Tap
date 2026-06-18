import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  EstadoSolicitud,
  SolicitudesResetService,
} from './solicitudes-reset.service';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';

@Controller('solicitudes-reset')
export class SolicitudesResetController {
  constructor(private readonly service: SolicitudesResetService) {}

  @Get()
  @RequirePermissions('usuarios.editar')
  listar(@Query('estado') estado?: EstadoSolicitud) {
    return this.service.listar(estado);
  }

  @Get('pendientes/contar')
  @RequirePermissions('usuarios.editar')
  async contarPendientes() {
    const total = await this.service.contarPendientes();
    return { total };
  }

  @Post(':id/aprobar')
  @RequirePermissions('usuarios.editar')
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.aprobar(id, req.user.id);
  }

  @Post(':id/rechazar')
  @RequirePermissions('usuarios.editar')
  async rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarSolicitudDto,
    @Request() req: { user: { id: number } },
  ) {
    await this.service.rechazar(id, req.user.id, dto.motivoRechazo);
    return { message: 'Solicitud rechazada' };
  }
}
