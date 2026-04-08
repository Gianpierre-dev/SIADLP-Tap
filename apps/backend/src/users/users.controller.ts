import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('usuarios.crear')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @RequirePermissions('usuarios.leer')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('usuarios.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('usuarios.editar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.usersService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('usuarios.eliminar')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deactivate(id);
  }
}
