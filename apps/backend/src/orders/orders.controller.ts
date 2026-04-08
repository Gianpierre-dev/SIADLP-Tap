import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderStatusDto } from './dto/change-order-status.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest {
  user: { id: number };
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermissions('pedidos.crear')
  create(@Body() dto: CreateOrderDto, @Request() req: AuthenticatedRequest) {
    return this.ordersService.create(dto, req.user.id);
  }

  @Get('by-date/:fecha')
  @RequirePermissions('pedidos.leer')
  findByDate(@Param('fecha') fecha: string) {
    return this.ordersService.findByDate(fecha);
  }

  @Get('history')
  @RequirePermissions('pedidos.leer')
  findHistory(
    @Query('estado') estado?: string,
    @Query('clienteId') clienteId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.ordersService.findHistory({
      estado,
      clienteId: clienteId ? Number(clienteId) : undefined,
      desde,
      hasta,
    });
  }

  @Get('production-summary/:fecha')
  @RequirePermissions('pedidos.leer')
  findConfirmedBySku(@Param('fecha') fecha: string) {
    return this.ordersService.findConfirmedBySku(fecha);
  }

  @Get()
  @RequirePermissions('pedidos.leer')
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('pedidos.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions('pedidos.editar')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeOrderStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ordersService.changeStatus(id, dto, req.user.id);
  }
}
