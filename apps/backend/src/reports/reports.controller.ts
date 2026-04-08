import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService, DashboardData } from './reports.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions('reportes.leer')
  getDashboard(@Query('fecha') fecha?: string): Promise<DashboardData> {
    const today = new Date().toISOString().split('T')[0];
    return this.reportsService.getDashboard(fecha ?? today);
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

  @Get('export/production')
  @RequirePermissions('reportes.exportar')
  async exportProduction(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportProduction(desde, hasta);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte-produccion.xlsx',
    );
    res.send(buffer);
  }

  @Get('export/inventory')
  @RequirePermissions('reportes.exportar')
  async exportInventory(@Res() res: Response) {
    const buffer = await this.reportsService.exportInventory();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reporte-inventario.xlsx',
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
}
