-- Limpieza de permisos huérfanos.
-- Los módulos compras, producción, inventario y proveedores quedaron FUERA del
-- alcance del MVP de distribución (sus tablas se eliminaron en la migración
-- distribucion_mvp), pero sus permisos siguieron registrados y aparecían en la
-- pantalla de roles. Se eliminan para que el catálogo de permisos coincida con
-- los módulos realmente existentes.
-- Los registros en rol_permisos se eliminan en cascada (onDelete: Cascade).
DELETE FROM "permisos" WHERE "modulo" IN ('compras', 'inventario', 'produccion', 'proveedores');
