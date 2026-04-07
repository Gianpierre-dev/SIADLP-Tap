import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [ClientsModule, SuppliersModule, ProductsModule],
})
export class CatalogsModule {}
