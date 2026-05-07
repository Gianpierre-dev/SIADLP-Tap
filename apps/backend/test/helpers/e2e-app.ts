import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ModuleMetadata,
} from '@nestjs/common';

/**
 * Bootstrap a NestJS test application that mirrors production configuration:
 * - Global prefix '/api'
 * - ValidationPipe with whitelist + forbidNonWhitelisted + transform
 *
 * Caller passes module metadata (imports/providers) and gets a ready-to-use
 * INestApplication for supertest. Always close it in `afterAll`.
 */
export async function createTestApp(
  metadata: ModuleMetadata,
): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule(metadata).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
