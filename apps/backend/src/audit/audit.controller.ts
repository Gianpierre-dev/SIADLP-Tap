import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
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
    @Query('accion') accion?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.auditService.findAll(
      {
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        modulo,
        accion,
        desde,
        hasta,
      },
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('export')
  @RequirePermissions('auditoria.leer')
  async export(
    @Res() res: Response,
    @Query('usuarioId') usuarioId?: string,
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const csv = await this.auditService.exportCsv({
      usuarioId: usuarioId ? Number(usuarioId) : undefined,
      modulo,
      accion,
      desde,
      hasta,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=auditoria.csv',
    );
    res.send(csv);
  }
}
