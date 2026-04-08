import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('auditoria.leer')
  findAll(
    @Query('usuarioId') usuarioId?: string,
    @Query('modulo') modulo?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.auditService.findAll({
      usuarioId: usuarioId ? Number(usuarioId) : undefined,
      modulo,
      desde,
      hasta,
    });
  }
}
