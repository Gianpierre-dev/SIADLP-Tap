import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
// LoggerModule must be imported AFTER any module that uses @InjectPinoLogger
// (e.g. AuthModule). nestjs-pino populates a global Set when service files
// are loaded; LoggerModule.register() reads that Set when called. Import-order
// matters here — keep it after the feature modules that decorate services.
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { OrdersModule } from './orders/orders.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { UbigeoModule } from './ubigeo/ubigeo.module';
import { EmpresaModule } from './empresa/empresa.module';
import { HealthModule } from './health/health.module';
// LoggerModule comes AFTER all feature module imports — see the comment at the
// top of this file for why import order matters.
import { LoggerModule } from './logger/logger.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';

@Module({
  imports: [
    // LoggerModule.register() is the FIRST runtime call in this array on purpose:
    // by now (runtime), all feature service files have been loaded by TS imports
    // above, so every @InjectPinoLogger(name) has registered its provider in the
    // nestjs-pino global Set. forRoot() reads that Set at call time.
    LoggerModule.register(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60_000, limit: 20 },
      { name: 'medium', ttl: 60_000, limit: 300 },
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
    UbigeoModule,
    EmpresaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
