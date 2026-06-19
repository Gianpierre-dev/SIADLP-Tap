-- Desactivar roles provisionados sin permisos asignados ni usuarios.
-- "Almacenero" y "Jefe de Producción" fueron creados para futuros módulos
-- (inventario y producción) que aún no se han implementado, por lo que
-- aparecen como ruido en el listado de roles.
UPDATE "roles" SET "activo" = false
WHERE "nombre" IN ('Almacenero', 'Jefe de Producción');
