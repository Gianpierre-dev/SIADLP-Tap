import type { PGlite } from '@electric-sql/pglite';
import {
  createTestDb,
  seedCliente,
  seedProducto,
  seedRol,
  seedRuta,
  seedUsuario,
} from '../helpers/pglite-helper';

describe('Constraints UNIQUE y FK', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('UNIQUE constraints', () => {
    it('Producto.codigoSku no acepta duplicados', async () => {
      await seedProducto(db, 'SKU-DUP-001');

      await expect(
        seedProducto(db, 'SKU-DUP-001', 'Otro nombre'),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it('Usuario.correo no acepta duplicados', async () => {
      const rolId = await seedRol(db);
      await seedUsuario(db, rolId, 'duplicado@siadlp.test');

      await expect(
        seedUsuario(db, rolId, 'duplicado@siadlp.test'),
      ).rejects.toThrow(/duplicate key|unique/i);
    });

    it('Rol.nombre no acepta duplicados', async () => {
      await seedRol(db, 'Administrador');

      await expect(seedRol(db, 'Administrador')).rejects.toThrow(
        /duplicate key|unique/i,
      );
    });

    it('Ruta.nombre no acepta duplicados', async () => {
      await seedRuta(db, 'Ruta Sur');

      await expect(seedRuta(db, 'Ruta Sur')).rejects.toThrow(
        /duplicate key|unique/i,
      );
    });

    it('Cliente.ruc acepta NULL múltiples veces (no es UNIQUE estricto sobre NULL)', async () => {
      const rutaId = await seedRuta(db);
      await seedCliente(db, rutaId, 'Cliente A');
      // Si no se especifica ruc, queda NULL — debería permitir varios
      await expect(
        seedCliente(db, rutaId, 'Cliente B'),
      ).resolves.toBeGreaterThan(0);
    });
  });

  describe('Foreign Key constraints', () => {
    it('No se puede crear Cliente con rutaId inexistente', async () => {
      await expect(seedCliente(db, 99999)).rejects.toThrow(
        /violates foreign key|constraint/i,
      );
    });

    it('No se puede crear Usuario con rolId inexistente', async () => {
      await expect(seedUsuario(db, 99999)).rejects.toThrow(
        /violates foreign key|constraint/i,
      );
    });

    it('No se puede crear Pedido con clienteId inexistente', async () => {
      const rolId = await seedRol(db);
      const userId = await seedUsuario(db, rolId);

      await expect(
        db.query(
          `INSERT INTO pedidos (cliente_id, fecha_entrega, creado_por_id, fecha_actualizacion)
           VALUES ($1, '2026-01-01', $2, NOW())`,
          [99999, userId],
        ),
      ).rejects.toThrow(/violates foreign key|constraint/i);
    });

    it('No se puede borrar Rol con Usuarios asociados (onDelete: Restrict)', async () => {
      const rolId = await seedRol(db);
      await seedUsuario(db, rolId);

      await expect(
        db.query(`DELETE FROM roles WHERE id = $1`, [rolId]),
      ).rejects.toThrow(/violates foreign key|constraint/i);
    });
  });

  describe('Cascade deletes', () => {
    it('Borrar Pedido borra sus DetallePedido (onDelete: Cascade)', async () => {
      // Setup: crear datos completos para un pedido
      const rolId = await seedRol(db);
      const userId = await seedUsuario(db, rolId);
      const rutaId = await seedRuta(db);
      const clienteId = await seedCliente(db, rutaId);
      const productoId = await seedProducto(db);

      const pedidoResult = await db.query<{ id: number }>(
        `INSERT INTO pedidos (cliente_id, fecha_entrega, creado_por_id, fecha_actualizacion)
         VALUES ($1, '2026-01-01', $2, NOW()) RETURNING id`,
        [clienteId, userId],
      );
      const pedidoId = pedidoResult.rows[0].id;

      await db.query(
        `INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad)
         VALUES ($1, $2, 10.50)`,
        [pedidoId, productoId],
      );

      // Sanity check
      const before = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM detalle_pedidos WHERE pedido_id = $1`,
        [pedidoId],
      );
      expect(before.rows[0].count).toBe(1);

      // Act: borrar el pedido
      await db.query(`DELETE FROM pedidos WHERE id = $1`, [pedidoId]);

      // Assert: el detalle también se borró
      const after = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM detalle_pedidos WHERE pedido_id = $1`,
        [pedidoId],
      );
      expect(after.rows[0].count).toBe(0);
    });

    it('Borrar Rol borra sus RolPermiso (onDelete: Cascade)', async () => {
      const rolId = await seedRol(db);
      const permisoResult = await db.query<{ id: number }>(
        `INSERT INTO permisos (modulo, accion) VALUES ('test', 'leer') RETURNING id`,
      );
      const permisoId = permisoResult.rows[0].id;
      await db.query(
        `INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ($1, $2)`,
        [rolId, permisoId],
      );

      const before = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM rol_permisos WHERE rol_id = $1`,
        [rolId],
      );
      expect(before.rows[0].count).toBe(1);

      // Borrar rol — los rol_permisos deberían desaparecer
      // pero hay restricción por usuarios — borramos el rol "Administrador" recién creado
      // sin usuarios asociados
      await db.query(`DELETE FROM roles WHERE id = $1`, [rolId]);

      const after = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM rol_permisos WHERE rol_id = $1`,
        [rolId],
      );
      expect(after.rows[0].count).toBe(0);
    });
  });
});
