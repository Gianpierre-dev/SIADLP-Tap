-- Roles base del sistema
INSERT INTO roles (nombre, descripcion) VALUES
  ('Administrador', 'Acceso completo al sistema'),
  ('Vendedor', 'Gestión de pedidos y clientes'),
  ('Jefe de Producción', 'Gestión de producción y planificación'),
  ('Almacenero', 'Control de inventario y recepción de compras'),
  ('Jefe de Despacho', 'Gestión de despacho y distribución'),
  ('Chofer', 'Registro de entregas y cobros en campo'),
  ('Gerente', 'Vista de dashboard, reportes y auditoría');

-- Permisos por módulo
INSERT INTO permisos (modulo, accion, descripcion) VALUES
  ('usuarios', 'crear', 'Crear usuarios'),
  ('usuarios', 'leer', 'Ver usuarios'),
  ('usuarios', 'editar', 'Editar usuarios'),
  ('usuarios', 'eliminar', 'Desactivar usuarios'),
  ('roles', 'crear', 'Crear roles'),
  ('roles', 'leer', 'Ver roles'),
  ('roles', 'editar', 'Editar roles y permisos'),
  ('roles', 'eliminar', 'Desactivar roles'),
  ('clientes', 'crear', 'Crear clientes'),
  ('clientes', 'leer', 'Ver clientes'),
  ('clientes', 'editar', 'Editar clientes'),
  ('clientes', 'eliminar', 'Desactivar clientes'),
  ('proveedores', 'crear', 'Crear proveedores'),
  ('proveedores', 'leer', 'Ver proveedores'),
  ('proveedores', 'editar', 'Editar proveedores'),
  ('proveedores', 'eliminar', 'Desactivar proveedores'),
  ('productos', 'crear', 'Crear productos'),
  ('productos', 'leer', 'Ver productos'),
  ('productos', 'editar', 'Editar productos'),
  ('productos', 'eliminar', 'Desactivar productos'),
  ('rutas', 'crear', 'Crear rutas'),
  ('rutas', 'leer', 'Ver rutas'),
  ('rutas', 'editar', 'Editar rutas'),
  ('rutas', 'eliminar', 'Desactivar rutas'),
  ('vehiculos', 'crear', 'Crear vehículos'),
  ('vehiculos', 'leer', 'Ver vehículos'),
  ('vehiculos', 'editar', 'Editar vehículos'),
  ('vehiculos', 'eliminar', 'Desactivar vehículos'),
  ('choferes', 'crear', 'Crear choferes'),
  ('choferes', 'leer', 'Ver choferes'),
  ('choferes', 'editar', 'Editar choferes'),
  ('choferes', 'eliminar', 'Desactivar choferes'),
  ('pedidos', 'crear', 'Crear pedidos'),
  ('pedidos', 'leer', 'Ver pedidos'),
  ('pedidos', 'editar', 'Editar pedidos'),
  ('pedidos', 'eliminar', 'Cancelar pedidos'),
  ('compras', 'crear', 'Crear órdenes de compra'),
  ('compras', 'leer', 'Ver órdenes de compra'),
  ('compras', 'editar', 'Editar órdenes de compra'),
  ('compras', 'eliminar', 'Cancelar órdenes de compra'),
  ('produccion', 'crear', 'Crear órdenes de producción'),
  ('produccion', 'leer', 'Ver órdenes de producción'),
  ('produccion', 'editar', 'Editar órdenes de producción'),
  ('produccion', 'eliminar', 'Cancelar órdenes de producción'),
  ('inventario', 'leer', 'Ver inventario'),
  ('inventario', 'ajustar', 'Realizar ajustes de inventario'),
  ('despacho', 'crear', 'Crear despachos'),
  ('despacho', 'leer', 'Ver despachos'),
  ('despacho', 'editar', 'Editar despachos'),
  ('despacho', 'registrar_entrega', 'Registrar entregas en campo'),
  ('reportes', 'leer', 'Ver reportes y dashboard'),
  ('reportes', 'exportar', 'Exportar reportes'),
  ('auditoria', 'leer', 'Ver log de auditoría');

-- Asignar TODOS los permisos al rol Administrador (id=1)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT 1, id FROM permisos;

-- Usuario administrador inicial
-- Contraseña: Admin123!
INSERT INTO usuarios (correo, contrasena, nombre, rol_id, fecha_creacion, fecha_actualizacion) VALUES
  ('admin@lacosecha.com', '$2b$10$xw2dl4PkGEVy35aWzzqdaO1Ds3BTLNQB6ewlnusG6C9XgC7aNgY3W', 'Administrador', 1, NOW(), NOW());
