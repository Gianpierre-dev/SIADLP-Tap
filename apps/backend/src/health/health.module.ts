import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';

/**
 * Health module. `PrismaModule` is global, so `PrismaService` is already in
 * the DI tree — we only need to register the Terminus module and our custom
 * indicator.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}
