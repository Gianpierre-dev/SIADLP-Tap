import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../helpers/pglite-helper';

describe('Schema — estructura de la base de datos', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('tablas críticas existen', () => {
    const expectedTables = [
      'usuarios',
      'roles',
      'permisos',
      'rol_permisos',
      'clientes',
      'productos',
      'rutas',
      'vehiculos',
      'choferes',
      'pedidos',
      'detalle_pedidos',
      'estado_pedido_logs',
      'hojas_carga',
      'entregas',
      'registro_auditoria',
      'departamentos',
      'provincias',
      'distritos',
      'empresa',
    ];

    it.each(expectedTables)('tabla "%s" existe', async (tableName) => {
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName],
      );
      expect(result.rows[0].count).toBe(1);
    });
  });

  describe('tablas eliminadas en refactor distribución MVP NO existen', () => {
    const removedTables = [
      'proveedores',
      'ordenes_compra',
      'detalle_ordenes_compra',
      'items_inventario',
      'movimientos_inventario',
      'ordenes_produccion',
      'productos_produccion',
      'insumos_produccion',
    ];

    it.each(removedTables)('tabla "%s" NO existe', async (tableName) => {
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName],
      );
      expect(result.rows[0].count).toBe(0);
    });
  });

  describe('campos eliminados en refactor MVP NO existen', () => {
    it.each([
      ['pedidos', 'total'],
      ['productos', 'precio_base'],
      ['productos', 'stock_minimo'],
      ['rutas', 'tarifa'],
      ['hojas_carga', 'numero_gre'],
      ['hojas_carga', 'total_monto'],
      ['entregas', 'monto_cobrado'],
      ['entregas', 'metodo_pago'],
      ['entregas', 'numero_comprobante'],
      ['detalle_pedidos', 'precio_unitario'],
      ['detalle_pedidos', 'subtotal'],
    ])('columna "%s.%s" NO existe', async (table, column) => {
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [table, column],
      );
      expect(result.rows[0].count).toBe(0);
    });
  });

  describe('índices críticos existen', () => {
    it.each([
      ['pedidos', 'pedidos_cliente_id_idx'],
      ['pedidos', 'pedidos_estado_idx'],
      ['pedidos', 'pedidos_fecha_entrega_idx'],
      ['hojas_carga', 'hojas_carga_estado_idx'],
      ['entregas', 'entregas_estado_idx'],
      ['registro_auditoria', 'registro_auditoria_modulo_idx'],
    ])('índice "%s" existe en tabla "%s"', async (table, indexName) => {
      const result = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = $1 AND indexname = $2`,
        [table, indexName],
      );
      expect(result.rows[0].count).toBe(1);
    });
  });
});
