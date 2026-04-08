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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ChangeOcStatusDto } from './dto/change-oc-status.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest {
  user: { id: number; correo: string; rolId: number };
}

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @RequirePermissions('compras.crear')
  create(@Body() dto: CreatePurchaseDto, @Request() req: AuthenticatedRequest) {
    return this.purchasesService.create(dto, req.user.id);
  }

  @Get('history')
  @RequirePermissions('compras.leer')
  findHistory(
    @Query('estado') estado?: string,
    @Query('proveedorId') proveedorId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.purchasesService.findHistory({
      estado,
      proveedorId: proveedorId ? Number(proveedorId) : undefined,
      desde,
      hasta,
    });
  }

  @Get()
  @RequirePermissions('compras.leer')
  findAll(
    @Query('estado') estado?: string,
    @Query('proveedorId') proveedorId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.purchasesService.findAll(
      { estado, proveedorId: proveedorId ? Number(proveedorId) : undefined },
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get(':id')
  @RequirePermissions('compras.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.purchasesService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions('compras.editar')
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeOcStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.purchasesService.changeStatus(id, dto, req.user.id);
  }

  @Post(':id/receive')
  @RequirePermissions('compras.editar')
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceivePurchaseDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.purchasesService.receive(id, dto, req.user.id);
  }
}
