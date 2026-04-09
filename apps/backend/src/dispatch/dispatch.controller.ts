import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { CreateLoadSheetDto } from './dto/create-load-sheet.dto';
import { ConfirmDispatchDto } from './dto/confirm-dispatch.dto';
import { RegisterDeliveryDto } from './dto/register-delivery.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest {
  user: { id: number; correo: string; rolId: number };
}

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  // Named routes BEFORE :id
  @Get('orders-by-route/:fecha')
  @RequirePermissions('despacho.leer')
  getOrdersGroupedByRoute(@Param('fecha') fecha: string) {
    return this.dispatchService.getOrdersGroupedByRoute(fecha);
  }

  @Get()
  @RequirePermissions('despacho.leer')
  findAll(
    @Query('fecha') fecha?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.dispatchService.findAll(
      fecha,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post()
  @RequirePermissions('despacho.crear')
  create(
    @Body() dto: CreateLoadSheetDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dispatchService.create(dto, req.user.id);
  }

  @Post(':id/start-route')
  @RequirePermissions('despacho.editar')
  startRoute(@Param('id', ParseIntPipe) id: number) {
    return this.dispatchService.startRoute(id);
  }

  @Get(':id')
  @RequirePermissions('despacho.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dispatchService.findOne(id);
  }

  @Get(':id/route-sheet')
  @RequirePermissions('despacho.leer')
  getRouteSheet(@Param('id', ParseIntPipe) id: number) {
    return this.dispatchService.getRouteSheet(id);
  }

  @Post(':id/confirm')
  @RequirePermissions('despacho.editar')
  confirmDispatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmDispatchDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dispatchService.confirmDispatch(id, dto, req.user.id);
  }

  @Get(':id/delivery-status')
  @RequirePermissions('despacho.leer')
  getDeliveryStatus(@Param('id', ParseIntPipe) id: number) {
    return this.dispatchService.getDeliveryStatus(id);
  }

  @Post('delivery/:pedidoId')
  @RequirePermissions('despacho.registrar_entrega')
  registerDelivery(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
    @Body() dto: RegisterDeliveryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dispatchService.registerDelivery(pedidoId, dto, req.user.id);
  }
}
