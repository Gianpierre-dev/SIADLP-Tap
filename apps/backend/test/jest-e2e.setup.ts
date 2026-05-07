// Environment variables required by the application during e2e bootstrap.
// Must be set BEFORE any application code is imported.
process.env['JWT_SECRET'] = 'test-jwt-secret-do-not-use-in-prod';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['API_PORT'] = '3001';
process.env['CORS_ORIGINS'] = 'http://localhost:3020';
