import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SolicitudesResetController } from './solicitudes-reset.controller';
import { SolicitarResetPublicoController } from './solicitar-reset-publico.controller';
import { SolicitudesResetService } from './solicitudes-reset.service';

@Module({
  imports: [UsersModule],
  controllers: [SolicitudesResetController, SolicitarResetPublicoController],
  providers: [SolicitudesResetService],
  exports: [SolicitudesResetService],
})
export class SolicitudesResetModule {}
