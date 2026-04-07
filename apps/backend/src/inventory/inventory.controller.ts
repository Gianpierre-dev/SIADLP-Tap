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
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { UpdateMinStockDto } from './dto/update-min-stock.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest {
  user: { id: number; correo: string; rolId: number };
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('mp')
  @RequirePermissions('inventario.leer')
  getStockMp() {
    return this.inventoryService.getStockMp();
  }

  @Get('pt')
  @RequirePermissions('inventario.leer')
  getStockPt() {
    return this.inventoryService.getStockPt();
  }

  @Get('alerts')
  @RequirePermissions('inventario.leer')
  getAlerts() {
    return this.inventoryService.getAlerts();
  }

  @Get(':itemId/kardex')
  @RequirePermissions('inventario.leer')
  getKardex(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.inventoryService.getKardex(itemId, { desde, hasta });
  }

  @Post(':itemId/adjust')
  @RequirePermissions('inventario.ajustar')
  adjustStock(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: AdjustInventoryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.inventoryService.adjustStock(itemId, dto, req.user.id);
  }

  @Patch(':itemId/min-stock')
  @RequirePermissions('inventario.ajustar')
  updateMinStock(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateMinStockDto,
  ) {
    return this.inventoryService.updateMinStock(itemId, dto);
  }
}
