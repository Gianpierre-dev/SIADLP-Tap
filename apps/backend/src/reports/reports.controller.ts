import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService, DashboardData } from './reports.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('reportes.leer')
  getDashboard(
    @Query('fecha') fecha?: string,
    @Query('periodo') periodo?: string,
    @Query('tendenciaDias') tendenciaDias?: string,
  ): Promise<DashboardData> {
    const today = new Date().toISOString().split('T')[0];
    return this.reportsService.getDashboard({
      fecha: fecha ?? today,
      periodo: periodo ?? 'dia',
      tendenciaDias: tendenciaDias ? Number(tendenciaDias) : 7,
    });
  }

  @Get('export/orders')
  @RequirePermissions('reportes.exportar')
  async exportOrders(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportOrders(desde, hasta);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte-pedidos.xlsx',
    );
    res.send(buffer);
  }

  @Get('export/dispatch')
  @RequirePermissions('reportes.exportar')
  async exportDispatch(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportDispatch(desde, hasta);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte-despachos.xlsx',
    );
    res.send(buffer);
  }

  @Get('export/issues')
  @RequirePermissions('reportes.exportar')
  async exportIssues(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportIssues(desde, hasta);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte-novedades.xlsx',
    );
    res.send(buffer);
  }

  @Get('export/by-driver')
  @RequirePermissions('reportes.exportar')
  async exportByDriver(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportByDriver(desde, hasta);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte-por-chofer.xlsx',
    );
    res.send(buffer);
  }
}
