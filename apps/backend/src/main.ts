import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CORS_ORIGINS',
  ] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Application cannot start.`,
    );
  }

  // Defense in depth: enforce JWT_SECRET strength at boot (also checked in AuthModule).
  const jwtSecret = process.env['JWT_SECRET']!;
  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters. Generate with: openssl rand -hex 32',
    );
  }
}

async function bootstrap() {
  validateEnv();

  // bufferLogs: true holds early framework logs until our nestjs-pino Logger is wired in,
  // so module-init messages also flow through Pino (structured JSON in prod, pretty in dev).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Replace the default Nest logger with the Pino-based one. From this point on,
  // every Logger call (including framework internals) uses structured logging
  // with the redaction, serializers, and request-id correlation we configured.
  app.useLogger(app.get(Logger));

  // Trust the first proxy hop so req.ip reflects X-Forwarded-For (Railway / reverse proxies).
  // Required for accurate audit logs and per-IP throttling.
  app.set('trust proxy', 1);

  // Hardened Helmet config — explicit headers instead of defaults so changes are auditable.
  // CSP defaults are conservative; if the API ever serves HTML, tighten further per route.
  app.use(
    helmet({
      // HSTS: force HTTPS for 1 year, include subdomains, allow preload.
      // Browsers ignore this on plain HTTP responses, so safe to enable in any env.
      strictTransportSecurity: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: true,
      },
      // Disallow framing (clickjacking).
      frameguard: { action: 'deny' },
      // Hide tech fingerprinting.
      hidePoweredBy: true,
      // X-Content-Type-Options: nosniff.
      noSniff: true,
      // Referrer-Policy: minimize cross-origin leakage.
      referrerPolicy: { policy: 'no-referrer' },
      // CSP — REST API doesn't render HTML, but defaults protect /uploads/ static assets.
      // 'self' for img-src so the logo can be displayed when proxied through the same origin.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          // Disallow framing of API responses.
          frameAncestors: ["'none'"],
          // Disallow form submissions targeting the API.
          formAction: ["'none'"],
          // Force upgrade of any embedded http:// URL.
          upgradeInsecureRequests: [],
        },
      },
      // Cross-Origin-Resource-Policy: same-site so /uploads/ logos can be fetched by the
      // frontend on the same eTLD+1 but not from arbitrary attacker pages.
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // Cap request body size to mitigate JSON/URL-encoded DoS via huge payloads.
  // 1 MB is generous for our DTOs (no file fields go through json — multer handles those).
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    // Disable directory listings, allow only the empresa logo path.
    index: false,
    // Set conservative cache (logo updates need to invalidate quickly).
    maxAge: 60_000,
    // Refuse path traversal attempts at the static layer (defense in depth — Nest already
    // resolves with `join` on a fixed root).
    fallthrough: false,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // In production, do not echo raw input back in 400 responses.
      disableErrorMessages: process.env['NODE_ENV'] === 'production',
    }),
  );

  const allowedOrigins = process.env['CORS_ORIGINS']!.split(',').map((o) =>
    o.trim(),
  );

  // Reject empty/wildcard CORS origin lists at boot — fail-secure.
  if (
    allowedOrigins.length === 0 ||
    allowedOrigins.some((o) => o === '*' || o === '')
  ) {
    throw new Error(
      'CORS_ORIGINS must be a comma-separated list of explicit origins (no "*"). ' +
        'Example: https://app.example.com,https://admin.example.com',
    );
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400, // cache preflight 24h
  });

  // Railway (y otros PaaS) inyectan PORT; localmente cae a API_PORT o 4020.
  const port = process.env['PORT'] ?? process.env['API_PORT'] ?? '4020';
  await app.listen(port);

  // Use the Pino logger directly (it implements the same `log` API as the
  // built-in Logger). This message flows through Pino so it gets the JSON
  // shape in prod and pretty colors in dev.
  const logger = app.get(Logger);
  logger.log(`Application running on port ${port}`, 'Bootstrap');
}
void bootstrap();
