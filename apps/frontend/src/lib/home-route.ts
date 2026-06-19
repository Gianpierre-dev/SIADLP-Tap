/**
 * Resuelve la primera ruta a la que el usuario tiene acceso según sus permisos.
 * Orden de prioridad alineado con el sidebar.
 *
 * Importante: si el usuario no tiene `reportes.leer`, NO debe ir a "/" porque
 * el dashboard pega a /api/reports/dashboard y devolveria 403, dejando al
 * usuario con un mensaje de error como primera pantalla.
 */
const RUTAS_POR_PERMISO: Array<{ permiso: string; ruta: string }> = [
  { permiso: 'reportes.leer', ruta: '/' },
  { permiso: 'pedidos.leer', ruta: '/pedidos' },
  { permiso: 'despacho.leer', ruta: '/despacho' },
  { permiso: 'clientes.leer', ruta: '/catalogos/clientes' },
  { permiso: 'productos.leer', ruta: '/catalogos/productos' },
  { permiso: 'usuarios.leer', ruta: '/usuarios' },
];

const RUTA_FALLBACK = '/';

export function resolverHomePorPermisos(permisos: string[]): string {
  const set = new Set(permisos);
  const match = RUTAS_POR_PERMISO.find((r) => set.has(r.permiso));
  return match?.ruta ?? RUTA_FALLBACK;
}
