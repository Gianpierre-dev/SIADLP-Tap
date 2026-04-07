import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest {
  user: { id: number; correo: string; rolId: number };
}

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post()
  @RequirePermissions('produccion.crear')
  create(
    @Body() dto: CreateProductionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.productionService.create(dto, req.user.id);
  }

  @Get('month-summary/:year/:month')
  @RequirePermissions('produccion.leer')
  findMonthSummary(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.productionService.findMonthSummary(year, month);
  }

  @Get()
  @RequirePermissions('produccion.leer')
  findAll() {
    return this.productionService.findAll();
  }

  @Get(':id')
  @RequirePermissions('produccion.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productionService.findOne(id);
  }

  @Post(':id/complete')
  @RequirePermissions('produccion.editar')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteProductionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.productionService.complete(id, dto, req.user.id);
  }
}
