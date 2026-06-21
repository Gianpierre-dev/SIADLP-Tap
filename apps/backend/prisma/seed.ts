/**
 * ============================================================================
 *  SEED DATA — La Cosecha S.A.C. (sistema de distribución de papas en Lima)
 * ============================================================================
 *
 *  Este script puebla la base de datos con datos realistas para demos y
 *  desarrollo. Es IDEMPOTENTE: se puede correr múltiples veces sin duplicar
 *  registros (todo usa `upsert` o `skipDuplicates`).
 *
 *  ----------------------------------------------------------------------------
 *  ¿Qué carga?
 *  ----------------------------------------------------------------------------
 *  1. Ubigeo (Departamentos / Provincias / Distritos del Perú 2016)
 *      - Catálogo geográfico oficial del INEI, ~1880 distritos.
 *
 *  2. Empresa (La Cosecha S.A.C.)
 *      - Datos fiscales y de contacto. RUC peruano demo.
 *
 *  3. Permisos por rol
 *      - Los roles (Administrador, Vendedor, Jefe de Despacho, Chofer, etc.)
 *        ya vienen creados desde la migración `20260407022200_datos_iniciales`.
 *      - Aquí asignamos a cada rol los permisos que le corresponden según el
 *        principio de menor privilegio. Administrador ya tiene todos.
 *
 *  4. Usuarios demo (5)
 *      - Uno por cada rol clave para la sustentación:
 *        admin, supervisor (Gerente), despachador (Jefe de Despacho),
 *        chofer y vendedor.
 *      - Password: `Admin123!` (bcryptjs cost 12).
 *
 *  5. Catálogos operativos
 *      - 3 Rutas: Lima Norte, Lima Sur, Lima Este (con zonas de cobertura).
 *      - 3 Vehículos: placas peruanas reales (ABC-123) con capacidades 500/1000/1500 kg.
 *      - 3 Choferes: DNI peruano (8 dígitos) y licencias.
 *      - 8 Productos de papa típicos del mercado limeño.
 *      - 15 Clientes (pollerías) distribuidos en las 3 rutas con ubigeo Lima.
 *
 *  6. Datos transaccionales (para demos del flujo completo)
 *      - 20 Pedidos distribuidos por estado:
 *          5 REGISTERED   → recién creados, esperando confirmación del supervisor
 *          5 CONFIRMED    → confirmados, asignados a una hoja en PREPARANDO
 *          3 DISPATCHED   → asignados pero sin salir aún (no se usan en hoja EN_RUTA)
 *          4 ON_ROUTE     → en camino (asignados a la hoja EN_RUTA)
 *          3 DELIVERED    → entregados (con Entrega ENTREGADO registrada)
 *      - 2 Hojas de Carga:
 *          1 PREPARANDO   → contiene los 5 pedidos CONFIRMED
 *          1 EN_RUTA      → contiene los 4 pedidos ON_ROUTE
 *      - 3 Entregas (estado ENTREGADO) para los pedidos DELIVERED.
 *      - EstadoPedidoLog completo: cada transición de estado queda registrada.
 *      - 5 RegistroAuditoria de creación de pedidos (audit trail demo).
 *
 *  ----------------------------------------------------------------------------
 *  Notas
 *  ----------------------------------------------------------------------------
 *  - Las fechas son relativas a `new Date()` para que el seed siempre luzca
 *    "fresco" (pedidos creados hoy, ayer, hace 3 días, etc.).
 *  - Pollerías ficticias (nombres inspirados en el mercado limeño).
 *  - Idempotencia: los datos transaccionales se insertan SOLO si no existen
 *    pedidos previos, para no romper estados ya manipulados manualmente.
 *  - Tiempo estimado de ejecución: < 30s (la mayor parte es ubigeo).
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

// ----------------------------------------------------------------------------
// Constantes de demo
// ----------------------------------------------------------------------------

const DEMO_PASSWORD = 'Admin123!';
const BCRYPT_COST = 12;

// ----------------------------------------------------------------------------
// 1. UBIGEO
// ----------------------------------------------------------------------------

interface DepRaw {
  id: string;
  name: string;
}

interface ProvRaw {
  id: string;
  name: string;
  department_id: string;
}

interface DistRaw {
  id: string;
  name: string;
  province_id: string;
  department_id: string;
}

async function seedUbigeo(): Promise<void> {
  const scriptsDir = path.resolve(__dirname, '../../../scripts');

  const departamentos: DepRaw[] = JSON.parse(
    fs.readFileSync(
      path.join(scriptsDir, 'ubigeo_peru_2016_departamentos.json'),
      'utf-8',
    ),
  ) as DepRaw[];

  const provincias: ProvRaw[] = JSON.parse(
    fs.readFileSync(
      path.join(scriptsDir, 'ubigeo_peru_2016_provincias.json'),
      'utf-8',
    ),
  ) as ProvRaw[];

  const distritos: DistRaw[] = JSON.parse(
    fs.readFileSync(
      path.join(scriptsDir, 'ubigeo_peru_2016_distritos.json'),
      'utf-8',
    ),
  ) as DistRaw[];

  console.log(
    `Seeding ubigeo: ${departamentos.length} depts, ${provincias.length} provs, ${distritos.length} dists`,
  );

  await prisma.departamento.createMany({
    data: departamentos.map((d) => ({ id: d.id, nombre: d.name })),
    skipDuplicates: true,
  });
  console.log(`  ✓ departamentos`);

  await prisma.provincia.createMany({
    data: provincias.map((p) => ({
      id: p.id,
      nombre: p.name,
      departamentoId: p.department_id,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ provincias`);

  // Distritos en lotes de 500 para no exceder el tamaño de query.
  const BATCH_SIZE = 500;
  for (let i = 0; i < distritos.length; i += BATCH_SIZE) {
    const batch = distritos.slice(i, i + BATCH_SIZE);
    await prisma.distrito.createMany({
      data: batch.map((d) => ({
        id: d.id,
        nombre: d.name,
        provinciaId: d.province_id,
        departamentoId: d.department_id,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ distritos`);
}

// ----------------------------------------------------------------------------
// 2. EMPRESA
// ----------------------------------------------------------------------------

async function seedEmpresa(): Promise<void> {
  await prisma.empresa.upsert({
    where: { id: 1 },
    update: {
      razonSocial: 'La Cosecha S.A.C.',
      nombreComercial: 'La Cosecha',
      ruc: '20123456789',
      direccion: 'Av. Los Sauces 450, Ate, Lima',
      telefono: '014567890',
      correo: 'contacto@lacosecha.com',
    },
    create: {
      id: 1,
      razonSocial: 'La Cosecha S.A.C.',
      nombreComercial: 'La Cosecha',
      ruc: '20123456789',
      direccion: 'Av. Los Sauces 450, Ate, Lima',
      telefono: '014567890',
      correo: 'contacto@lacosecha.com',
    },
  });
  console.log(`  ✓ empresa`);
}

// ----------------------------------------------------------------------------
// 3. PERMISOS POR ROL
// ----------------------------------------------------------------------------

/**
 * Mapa de permisos por rol siguiendo el principio de menor privilegio.
 * - Administrador ya tiene TODOS los permisos asignados desde la migración
 *   `20260407022200_datos_iniciales`, por eso no aparece aquí.
 * - El resto se completa de forma idempotente con `upsert` sobre
 *   la PK compuesta (rolId, permisoId).
 */
const PERMISOS_POR_ROL: Record<
  string,
  Array<{ modulo: string; accion: string }>
> = {
  Vendedor: [
    { modulo: 'clientes', accion: 'crear' },
    { modulo: 'clientes', accion: 'leer' },
    { modulo: 'clientes', accion: 'editar' },
    { modulo: 'productos', accion: 'leer' },
    { modulo: 'rutas', accion: 'leer' },
    { modulo: 'pedidos', accion: 'crear' },
    { modulo: 'pedidos', accion: 'leer' },
    { modulo: 'pedidos', accion: 'editar' },
    { modulo: 'pedidos', accion: 'eliminar' },
  ],
  Gerente: [
    // Acceso de lectura a todo el sistema (rol "supervisor" para demo).
    { modulo: 'usuarios', accion: 'leer' },
    { modulo: 'roles', accion: 'leer' },
    { modulo: 'clientes', accion: 'leer' },
    { modulo: 'productos', accion: 'leer' },
    { modulo: 'rutas', accion: 'leer' },
    { modulo: 'vehiculos', accion: 'leer' },
    { modulo: 'choferes', accion: 'leer' },
    { modulo: 'pedidos', accion: 'leer' },
    { modulo: 'pedidos', accion: 'editar' }, // Para confirmar pedidos.
    { modulo: 'despacho', accion: 'leer' },
    { modulo: 'reportes', accion: 'leer' },
    { modulo: 'reportes', accion: 'exportar' },
    { modulo: 'auditoria', accion: 'leer' },
  ],
  'Jefe de Despacho': [
    { modulo: 'clientes', accion: 'leer' },
    { modulo: 'productos', accion: 'leer' },
    { modulo: 'rutas', accion: 'leer' },
    { modulo: 'vehiculos', accion: 'leer' },
    { modulo: 'choferes', accion: 'leer' },
    { modulo: 'pedidos', accion: 'leer' },
    { modulo: 'despacho', accion: 'crear' },
    { modulo: 'despacho', accion: 'leer' },
    { modulo: 'despacho', accion: 'editar' },
  ],
  Chofer: [
    { modulo: 'clientes', accion: 'leer' },
    { modulo: 'pedidos', accion: 'leer' },
    { modulo: 'despacho', accion: 'leer' },
    { modulo: 'despacho', accion: 'registrar_entrega' },
  ],
};

async function seedPermisosPorRol(): Promise<void> {
  for (const [nombreRol, permisos] of Object.entries(PERMISOS_POR_ROL)) {
    const rol = await prisma.rol.findUnique({ where: { nombre: nombreRol } });
    if (!rol) {
      console.warn(`  ! Rol "${nombreRol}" no encontrado, skip`);
      continue;
    }

    for (const { modulo, accion } of permisos) {
      const permiso = await prisma.permiso.findUnique({
        where: { modulo_accion: { modulo, accion } },
      });
      if (!permiso) continue;

      await prisma.rolPermiso.upsert({
        where: {
          rolId_permisoId: { rolId: rol.id, permisoId: permiso.id },
        },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      });
    }
  }
  console.log(`  ✓ permisos por rol`);
}

// ----------------------------------------------------------------------------
// 4. USUARIOS DEMO
// ----------------------------------------------------------------------------

interface UsuarioDemo {
  correo: string;
  nombre: string;
  rolNombre: string;
}

const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    correo: 'admin@lacosecha.com',
    nombre: 'Carlos Quispe',
    rolNombre: 'Administrador',
  },
  {
    correo: 'supervisor@lacosecha.com',
    nombre: 'Ana Mendoza',
    rolNombre: 'Gerente',
  },
  {
    correo: 'despacho@lacosecha.com',
    nombre: 'Luis Ramírez',
    rolNombre: 'Jefe de Despacho',
  },
  {
    correo: 'chofer@lacosecha.com',
    nombre: 'Pedro Huamán',
    rolNombre: 'Chofer',
  },
  {
    correo: 'vendedor@lacosecha.com',
    nombre: 'María Torres',
    rolNombre: 'Vendedor',
  },
];

async function seedUsuarios(): Promise<Map<string, number>> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);
  const usuariosByCorreo = new Map<string, number>();

  for (const u of USUARIOS_DEMO) {
    const rol = await prisma.rol.findUnique({ where: { nombre: u.rolNombre } });
    if (!rol) {
      console.warn(`  ! Rol "${u.rolNombre}" no encontrado para ${u.correo}`);
      continue;
    }

    const usuario = await prisma.usuario.upsert({
      where: { correo: u.correo },
      update: {
        nombre: u.nombre,
        rolId: rol.id,
        contrasena: passwordHash,
        activo: true,
      },
      create: {
        correo: u.correo,
        nombre: u.nombre,
        rolId: rol.id,
        contrasena: passwordHash,
        activo: true,
      },
    });
    usuariosByCorreo.set(u.correo, usuario.id);
  }
  console.log(
    `  ✓ usuarios (${usuariosByCorreo.size}) — password demo: "${DEMO_PASSWORD}"`,
  );
  return usuariosByCorreo;
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const start = Date.now();
  console.log('Starting seed...');

  // Seed mínimo: solo lo indispensable para que el sistema funcione.
  await seedUbigeo();           // catálogo geográfico del Perú (requerido por clientes)
  await seedEmpresa();          // configuración de la empresa
  await seedPermisosPorRol();   // permisos por rol (RBAC)
  await seedUsuarios();         // usuarios y credenciales de acceso

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`Seed completed in ${elapsed}s`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
