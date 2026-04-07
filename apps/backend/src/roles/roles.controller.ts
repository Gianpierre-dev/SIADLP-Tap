import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermissions('roles.crear')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @RequirePermissions('roles.leer')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @RequirePermissions('roles.leer')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Get(':id')
  @RequirePermissions('roles.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('roles.editar')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }
}
