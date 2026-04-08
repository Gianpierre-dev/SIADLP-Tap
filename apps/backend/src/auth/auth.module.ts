import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env['JWT_SECRET'];
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET must be defined and at least 32 characters. Generate with: openssl rand -hex 32',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '2h') as StringValue,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
