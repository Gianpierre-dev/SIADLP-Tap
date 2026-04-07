import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { RoutesModule } from './routes/routes.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DriversModule } from './drivers/drivers.module';

@Module({
  imports: [
    ClientsModule,
    SuppliersModule,
    ProductsModule,
    RoutesModule,
    VehiclesModule,
    DriversModule,
  ],
})
export class CatalogsModule {}
