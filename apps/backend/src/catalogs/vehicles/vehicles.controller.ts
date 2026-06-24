import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';

@Controller('catalogs/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @RequirePermissions('vehiculos.crear')
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Get()
  @RequirePermissions('vehiculos.leer')
  findAll(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.vehiclesService.findAll(incluirInactivos === 'true');
  }

  @Get(':id')
  @RequirePermissions('vehiculos.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('vehiculos.editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('vehiculos.eliminar')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.deactivate(id);
  }

  @Patch(':id/reactivar')
  @RequirePermissions('vehiculos.eliminar')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.reactivate(id);
  }
}
