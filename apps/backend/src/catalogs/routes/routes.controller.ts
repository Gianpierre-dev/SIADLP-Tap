import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';

@Controller('catalogs/routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @RequirePermissions('rutas.crear')
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Get()
  @RequirePermissions('rutas.leer')
  findAll() {
    return this.routesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('rutas.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('rutas.editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('rutas.eliminar')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.routesService.deactivate(id);
  }
}
