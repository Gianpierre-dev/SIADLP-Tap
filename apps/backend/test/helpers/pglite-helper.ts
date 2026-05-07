import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_SQL = readFileSync(
  join(__dirname, '..', 'integration', '__schema__.sql'),
  'utf-8',
);

/**
 * Setup an in-memory PostgreSQL database with the full Prisma schema applied.
 *
 * Each test suite that needs DB access should call this in `beforeEach` to get
 * a fresh, isolated database. The returned `db.close()` MUST be called in
 * `afterEach` to release resources.
 */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SCHEMA_SQL);
  return db;
}

/**
 * Insert a baseline Rol so that Usuario inserts can satisfy the FK constraint.
 * Returns the rol id.
 */
export async function seedRol(
  db: PGlite,
  nombre = 'Administrador',
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO roles (nombre, activo) VALUES ($1, true) RETURNING id`,
    [nombre],
  );
  return result.rows[0].id;
}

/**
 * Insert a baseline Usuario for tests that need a user reference.
 * Returns the user id.
 */
export async function seedUsuario(
  db: PGlite,
  rolId: number,
  correo = 'test@siadlp.test',
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO usuarios (correo, contrasena, nombre, rol_id, fecha_actualizacion)
     VALUES ($1, '$2a$12$hashed', 'Test User', $2, NOW())
     RETURNING id`,
    [correo, rolId],
  );
  return result.rows[0].id;
}

/**
 * Insert a baseline Ruta. Returns the ruta id.
 */
export async function seedRuta(
  db: PGlite,
  nombre = 'Ruta Norte',
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO rutas (nombre, zona, activa) VALUES ($1, 'Norte', true) RETURNING id`,
    [nombre],
  );
  return result.rows[0].id;
}

/**
 * Insert a baseline Cliente. Requires a ruta id.
 */
export async function seedCliente(
  db: PGlite,
  rutaId: number,
  razonSocial = 'Cliente Test SAC',
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO clientes (razon_social, direccion, ruta_id, activo, fecha_actualizacion)
     VALUES ($1, 'Av. Test 123', $2, true, NOW())
     RETURNING id`,
    [razonSocial, rutaId],
  );
  return result.rows[0].id;
}

/**
 * Insert a baseline Producto.
 */
export async function seedProducto(
  db: PGlite,
  codigoSku = 'SKU-TEST-001',
  nombre = 'Producto Test',
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO productos (nombre, codigo_sku, unidad_medida, activo, fecha_actualizacion)
     VALUES ($1, $2, 'KG', true, NOW())
     RETURNING id`,
    [nombre, codigoSku],
  );
  return result.rows[0].id;
}
