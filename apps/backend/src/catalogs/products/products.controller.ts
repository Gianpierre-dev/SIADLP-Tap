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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';

@Controller('catalogs/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions('productos.crear')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @RequirePermissions('productos.leer')
  findAll(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.productsService.findAll(incluirInactivos === 'true');
  }

  @Get(':id')
  @RequirePermissions('productos.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('productos.editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('productos.eliminar')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivate(id);
  }

  @Patch(':id/reactivar')
  @RequirePermissions('productos.eliminar')
  reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.reactivate(id);
  }
}
