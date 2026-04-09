import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { OrdersModule } from './orders/orders.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CatalogsModule,
    OrdersModule,
    DispatchModule,
    AuditModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
