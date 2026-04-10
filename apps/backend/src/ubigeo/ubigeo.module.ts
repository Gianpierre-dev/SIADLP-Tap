import { Module } from '@nestjs/common';
import { UbigeoController } from './ubigeo.controller';
import { UbigeoService } from './ubigeo.service';

@Module({
  controllers: [UbigeoController],
  providers: [UbigeoService],
})
export class UbigeoModule {}
