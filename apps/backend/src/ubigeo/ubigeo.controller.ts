import { Controller, Get, Param } from '@nestjs/common';
import { UbigeoService } from './ubigeo.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('ubigeo')
export class UbigeoController {
  constructor(private readonly ubigeoService: UbigeoService) {}

  @Public()
  @Get('departamentos')
  findDepartamentos() {
    return this.ubigeoService.findDepartamentos();
  }

  @Public()
  @Get('provincias/:departamentoId')
  findProvincias(@Param('departamentoId') departamentoId: string) {
    return this.ubigeoService.findProvincias(departamentoId);
  }

  @Public()
  @Get('distritos/:provinciaId')
  findDistritos(@Param('provinciaId') provinciaId: string) {
    return this.ubigeoService.findDistritos(provinciaId);
  }
}
