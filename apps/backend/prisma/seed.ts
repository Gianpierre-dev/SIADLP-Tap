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
 *      - Password: `password123` (bcryptjs cost 12).
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

const DEMO_PASSWORD = 'password123';
const BCRYPT_COST = 12;

/** Suma `days` (positivo o negativo) a `base` y devuelve un nuevo Date. */
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

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
// 5. CATÁLOGOS OPERATIVOS
// ----------------------------------------------------------------------------

interface RutaSeed {
  nombre: string;
  zona: string;
  descripcion: string;
}

const RUTAS_SEED: RutaSeed[] = [
  {
    nombre: 'Lima Norte',
    zona: 'Comas, Los Olivos, San Martín de Porres, Independencia',
    descripcion: 'Cobertura de pollerías en el cono norte de Lima.',
  },
  {
    nombre: 'Lima Sur',
    zona: 'Villa El Salvador, Villa María del Triunfo, San Juan de Miraflores, Chorrillos',
    descripcion: 'Cobertura de pollerías en el cono sur de Lima.',
  },
  {
    nombre: 'Lima Este',
    zona: 'Ate, Santa Anita, San Juan de Lurigancho, El Agustino',
    descripcion: 'Cobertura de pollerías en el cono este de Lima.',
  },
];

async function seedRutas(): Promise<Map<string, number>> {
  const rutasByNombre = new Map<string, number>();
  for (const r of RUTAS_SEED) {
    const ruta = await prisma.ruta.upsert({
      where: { nombre: r.nombre },
      update: { zona: r.zona, descripcion: r.descripcion, activa: true },
      create: { nombre: r.nombre, zona: r.zona, descripcion: r.descripcion },
    });
    rutasByNombre.set(r.nombre, ruta.id);
  }
  console.log(`  ✓ rutas (${rutasByNombre.size})`);
  return rutasByNombre;
}

interface VehiculoSeed {
  placa: string;
  marca: string;
  modelo: string;
  capacidadKg: number;
}

const VEHICULOS_SEED: VehiculoSeed[] = [
  { placa: 'ABC-123', marca: 'Hyundai', modelo: 'H100', capacidadKg: 500 },
  {
    placa: 'BDG-456',
    marca: 'Mitsubishi',
    modelo: 'Canter',
    capacidadKg: 1000,
  },
  { placa: 'CFK-789', marca: 'Hino', modelo: '300 Series', capacidadKg: 1500 },
];

async function seedVehiculos(): Promise<Map<string, number>> {
  const vehiculosByPlaca = new Map<string, number>();
  for (const v of VEHICULOS_SEED) {
    const vehiculo = await prisma.vehiculo.upsert({
      where: { placa: v.placa },
      update: {
        marca: v.marca,
        modelo: v.modelo,
        capacidadKg: v.capacidadKg,
        activo: true,
      },
      create: {
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        capacidadKg: v.capacidadKg,
      },
    });
    vehiculosByPlaca.set(v.placa, vehiculo.id);
  }
  console.log(`  ✓ vehiculos (${vehiculosByPlaca.size})`);
  return vehiculosByPlaca;
}

interface ChoferSeed {
  dni: string;
  nombre: string;
  apellido: string;
  licencia: string;
  telefono: string;
}

const CHOFERES_SEED: ChoferSeed[] = [
  {
    dni: '45678912',
    nombre: 'Juan',
    apellido: 'Pérez Lozano',
    licencia: 'A-IIIa Q45678912',
    telefono: '987123456',
  },
  {
    dni: '40112233',
    nombre: 'Roberto',
    apellido: 'Salazar Vega',
    licencia: 'A-IIIb Q40112233',
    telefono: '987654321',
  },
  {
    dni: '47889900',
    nombre: 'Miguel',
    apellido: 'Castillo Rojas',
    licencia: 'A-IIIa Q47889900',
    telefono: '912345678',
  },
];

async function seedChoferes(): Promise<Map<string, number>> {
  const choferesByDni = new Map<string, number>();
  for (const c of CHOFERES_SEED) {
    const chofer = await prisma.chofer.upsert({
      where: { dni: c.dni },
      update: {
        nombre: c.nombre,
        apellido: c.apellido,
        licencia: c.licencia,
        telefono: c.telefono,
        activo: true,
      },
      create: { ...c },
    });
    choferesByDni.set(c.dni, chofer.id);
  }
  console.log(`  ✓ choferes (${choferesByDni.size})`);
  return choferesByDni;
}

interface ProductoSeed {
  codigoSku: string;
  nombre: string;
  descripcion: string;
}

const PRODUCTOS_SEED: ProductoSeed[] = [
  {
    codigoSku: 'PAP-AMA-001',
    nombre: 'Papa Amarilla',
    descripcion:
      'Papa amarilla nativa, ideal para papa a la huancaína y causa.',
  },
  {
    codigoSku: 'PAP-CAN-002',
    nombre: 'Papa Canchán',
    descripcion: 'Papa rosada, multiuso. Muy demandada por pollerías.',
  },
  {
    codigoSku: 'PAP-YUN-003',
    nombre: 'Papa Yungay',
    descripcion: 'Papa blanca grande, excelente para freír (pollería).',
  },
  {
    codigoSku: 'PAP-HUA-004',
    nombre: 'Papa Huayro',
    descripcion: 'Papa nativa morada, ideal para guisos y sancochado.',
  },
  {
    codigoSku: 'PAP-PER-005',
    nombre: 'Papa Peruanita',
    descripcion: 'Papa nativa pequeña de cáscara delgada, sabor intenso.',
  },
  {
    codigoSku: 'PAP-TUM-006',
    nombre: 'Papa Tumbay',
    descripcion: 'Papa amarilla harinosa, para purés y locro.',
  },
  {
    codigoSku: 'PAP-COL-007',
    nombre: 'Papa Colorada',
    descripcion: 'Papa de cáscara roja, firme, ideal para sancochado.',
  },
  {
    codigoSku: 'PAP-NEG-008',
    nombre: 'Papa Negra Andina',
    descripcion: 'Papa nativa de pulpa morada, para platos gourmet.',
  },
];

async function seedProductos(): Promise<Map<string, number>> {
  const productosBySku = new Map<string, number>();
  for (const p of PRODUCTOS_SEED) {
    const producto = await prisma.producto.upsert({
      where: { codigoSku: p.codigoSku },
      update: {
        nombre: p.nombre,
        descripcion: p.descripcion,
        unidadMedida: 'kg',
        activo: true,
      },
      create: {
        codigoSku: p.codigoSku,
        nombre: p.nombre,
        descripcion: p.descripcion,
        unidadMedida: 'kg',
      },
    });
    productosBySku.set(p.codigoSku, producto.id);
  }
  console.log(`  ✓ productos (${productosBySku.size})`);
  return productosBySku;
}

// ----------------------------------------------------------------------------
// CLIENTES (Pollerías de Lima)
// ----------------------------------------------------------------------------

interface ClienteSeed {
  ruc: string; // Único, sirve de clave de upsert.
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  telefono: string;
  contacto: string;
  distritoId: string; // ubigeo (6 chars)
  rutaNombre: string; // 'Lima Norte' | 'Lima Sur' | 'Lima Este'
}

const CLIENTES_SEED: ClienteSeed[] = [
  // ─── Lima Norte (5) ──────────────────────────────────────────────────
  {
    ruc: '20501010101',
    razonSocial: 'Pollería La Brasa Dorada E.I.R.L.',
    nombreComercial: 'La Brasa Dorada',
    direccion: 'Av. Túpac Amaru 1234, Comas',
    telefono: '014561111',
    contacto: 'Sr. José Vargas',
    distritoId: '150110', // Comas
    rutaNombre: 'Lima Norte',
  },
  {
    ruc: '20501010202',
    razonSocial: 'Don Pollo Norte S.A.C.',
    nombreComercial: 'Don Pollo',
    direccion: 'Av. Antúnez de Mayolo 456, Los Olivos',
    telefono: '014562222',
    contacto: 'Sra. Lucía Flores',
    distritoId: '150117', // Los Olivos
    rutaNombre: 'Lima Norte',
  },
  {
    ruc: '20501010303',
    razonSocial: 'El Pollo Real S.A.C.',
    nombreComercial: 'El Pollo Real',
    direccion: 'Av. Perú 789, San Martín de Porres',
    telefono: '014563333',
    contacto: 'Sr. Manuel Rojas',
    distritoId: '150135', // SMP
    rutaNombre: 'Lima Norte',
  },
  {
    ruc: '20501010404',
    razonSocial: 'Brasas del Norte S.R.L.',
    nombreComercial: 'Brasas del Norte',
    direccion: 'Av. Naranjal 321, Independencia',
    telefono: '014564444',
    contacto: 'Sra. Rosa Quispe',
    distritoId: '150112', // Independencia
    rutaNombre: 'Lima Norte',
  },
  {
    ruc: '20501010505',
    razonSocial: 'Pollería El Caporal Norte S.A.C.',
    nombreComercial: 'El Caporal',
    direccion: 'Av. Universitaria 1500, Los Olivos',
    telefono: '014565555',
    contacto: 'Sr. Eduardo Salas',
    distritoId: '150117', // Los Olivos
    rutaNombre: 'Lima Norte',
  },
  // ─── Lima Sur (5) ────────────────────────────────────────────────────
  {
    ruc: '20502020101',
    razonSocial: 'Pollería La Leña Sur E.I.R.L.',
    nombreComercial: 'La Leña',
    direccion: 'Av. Pastor Sevilla 600, Villa El Salvador',
    telefono: '014566666',
    contacto: 'Sra. Patricia Ríos',
    distritoId: '150142', // VES
    rutaNombre: 'Lima Sur',
  },
  {
    ruc: '20502020202',
    razonSocial: 'Pollos a la Brasa Don Tito S.A.C.',
    nombreComercial: 'Don Tito',
    direccion: 'Av. 26 de Noviembre 850, Villa María del Triunfo',
    telefono: '014567777',
    contacto: 'Sr. Tito Mamani',
    distritoId: '150143', // VMT
    rutaNombre: 'Lima Sur',
  },
  {
    ruc: '20502020303',
    razonSocial: 'El Pollón S.R.L.',
    nombreComercial: 'El Pollón',
    direccion: 'Av. Los Héroes 234, San Juan de Miraflores',
    telefono: '014568888',
    contacto: 'Sra. Elena Cárdenas',
    distritoId: '150133', // SJM
    rutaNombre: 'Lima Sur',
  },
  {
    ruc: '20502020404',
    razonSocial: 'Brasa y Sabor S.A.C.',
    nombreComercial: 'Brasa y Sabor',
    direccion: 'Av. Defensores del Morro 901, Chorrillos',
    telefono: '014569999',
    contacto: 'Sr. Andrés Paredes',
    distritoId: '150108', // Chorrillos
    rutaNombre: 'Lima Sur',
  },
  {
    ruc: '20502020505',
    razonSocial: 'Pollería La Granja Sur E.I.R.L.',
    nombreComercial: 'La Granja',
    direccion: 'Av. Mariano Pastor Sevilla 1245, Villa El Salvador',
    telefono: '014570001',
    contacto: 'Sra. Carmen Núñez',
    distritoId: '150142', // VES
    rutaNombre: 'Lima Sur',
  },
  // ─── Lima Este (5) ───────────────────────────────────────────────────
  {
    ruc: '20503030101',
    razonSocial: 'Pollería Las Brasas del Este S.A.C.',
    nombreComercial: 'Las Brasas del Este',
    direccion: 'Av. Nicolás Ayllón 3000, Ate',
    telefono: '014571112',
    contacto: 'Sr. Felipe Aguilar',
    distritoId: '150103', // Ate
    rutaNombre: 'Lima Este',
  },
  {
    ruc: '20503030202',
    razonSocial: 'Pollos San Carlos S.R.L.',
    nombreComercial: 'San Carlos',
    direccion: 'Av. Los Ruiseñores 250, Santa Anita',
    telefono: '014571223',
    contacto: 'Sra. Beatriz Ortega',
    distritoId: '150137', // Santa Anita
    rutaNombre: 'Lima Este',
  },
  {
    ruc: '20503030303',
    razonSocial: 'Pollería El Rancho E.I.R.L.',
    nombreComercial: 'El Rancho',
    direccion: 'Av. Las Flores 1820, San Juan de Lurigancho',
    telefono: '014571334',
    contacto: 'Sr. Walter Cárdenas',
    distritoId: '150132', // SJL
    rutaNombre: 'Lima Este',
  },
  {
    ruc: '20503030404',
    razonSocial: 'Brasa Suprema del Este S.A.C.',
    nombreComercial: 'Brasa Suprema',
    direccion: 'Av. Próceres de la Independencia 4500, San Juan de Lurigancho',
    telefono: '014571445',
    contacto: 'Sra. Verónica León',
    distritoId: '150132', // SJL
    rutaNombre: 'Lima Este',
  },
  {
    ruc: '20503030505',
    razonSocial: 'Pollería El Imperio Andino S.A.C.',
    nombreComercial: 'El Imperio',
    direccion: 'Av. Riva Agüero 1100, El Agustino',
    telefono: '014571556',
    contacto: 'Sr. César Tipula',
    distritoId: '150111', // El Agustino
    rutaNombre: 'Lima Este',
  },
];

async function seedClientes(
  rutasByNombre: Map<string, number>,
): Promise<number[]> {
  const clienteIds: number[] = [];
  for (const c of CLIENTES_SEED) {
    const rutaId = rutasByNombre.get(c.rutaNombre);
    if (!rutaId) {
      throw new Error(
        `Ruta "${c.rutaNombre}" no encontrada para cliente ${c.ruc}`,
      );
    }
    const cliente = await prisma.cliente.upsert({
      where: { ruc: c.ruc },
      update: {
        razonSocial: c.razonSocial,
        nombreComercial: c.nombreComercial,
        direccion: c.direccion,
        telefono: c.telefono,
        contacto: c.contacto,
        departamentoId: '15', // Lima
        provinciaId: '1501', // Lima
        distritoId: c.distritoId,
        rutaId,
        activo: true,
      },
      create: {
        razonSocial: c.razonSocial,
        nombreComercial: c.nombreComercial,
        ruc: c.ruc,
        direccion: c.direccion,
        telefono: c.telefono,
        contacto: c.contacto,
        departamentoId: '15',
        provinciaId: '1501',
        distritoId: c.distritoId,
        rutaId,
      },
    });
    clienteIds.push(cliente.id);
  }
  console.log(`  ✓ clientes (${clienteIds.length})`);
  return clienteIds;
}

// ----------------------------------------------------------------------------
// 6. DATOS TRANSACCIONALES
// ----------------------------------------------------------------------------

interface DetalleSeed {
  productoSku: string;
  cantidadKg: number;
}

interface PedidoSeed {
  /** Índice del cliente (en `clienteIds`) al que pertenece. Permite distribuir
   *  los pedidos de forma realista entre las 3 rutas. */
  clienteIdx: number;
  /** Días desde hoy en que se creó el pedido (negativo = en el pasado). */
  diasDesdeHoy: number;
  /** Días desde hoy en que se debe entregar (positivo o cero). */
  fechaEntregaOffset: number;
  estadoFinal:
    | 'REGISTERED'
    | 'CONFIRMED'
    | 'DISPATCHED'
    | 'ON_ROUTE'
    | 'DELIVERED';
  detalles: DetalleSeed[];
  observacion?: string;
}

const PEDIDOS_SEED: PedidoSeed[] = [
  // ─── 5 REGISTERED (recién creados, esperando confirmación) ────────────
  {
    clienteIdx: 0,
    diasDesdeHoy: 0,
    fechaEntregaOffset: 2,
    estadoFinal: 'REGISTERED',
    detalles: [
      { productoSku: 'PAP-YUN-003', cantidadKg: 80 },
      { productoSku: 'PAP-AMA-001', cantidadKg: 25 },
    ],
    observacion: 'Pedido urgente, entregar antes de las 10am',
  },
  {
    clienteIdx: 5,
    diasDesdeHoy: 0,
    fechaEntregaOffset: 2,
    estadoFinal: 'REGISTERED',
    detalles: [{ productoSku: 'PAP-YUN-003', cantidadKg: 100 }],
  },
  {
    clienteIdx: 10,
    diasDesdeHoy: -1,
    fechaEntregaOffset: 1,
    estadoFinal: 'REGISTERED',
    detalles: [
      { productoSku: 'PAP-CAN-002', cantidadKg: 60 },
      { productoSku: 'PAP-COL-007', cantidadKg: 40 },
    ],
  },
  {
    clienteIdx: 2,
    diasDesdeHoy: 0,
    fechaEntregaOffset: 3,
    estadoFinal: 'REGISTERED',
    detalles: [{ productoSku: 'PAP-AMA-001', cantidadKg: 50 }],
  },
  {
    clienteIdx: 12,
    diasDesdeHoy: 0,
    fechaEntregaOffset: 2,
    estadoFinal: 'REGISTERED',
    detalles: [
      { productoSku: 'PAP-YUN-003', cantidadKg: 70 },
      { productoSku: 'PAP-HUA-004', cantidadKg: 20 },
    ],
  },
  // ─── 5 CONFIRMED (asignados a hoja PREPARANDO) ────────────────────────
  // Para que la hoja PREPARANDO sea coherente, todos comparten ruta.
  // Hoja 1 = Lima Norte → clientes 0..4.
  {
    clienteIdx: 1,
    diasDesdeHoy: -1,
    fechaEntregaOffset: 1,
    estadoFinal: 'CONFIRMED',
    detalles: [{ productoSku: 'PAP-YUN-003', cantidadKg: 90 }],
  },
  {
    clienteIdx: 3,
    diasDesdeHoy: -1,
    fechaEntregaOffset: 1,
    estadoFinal: 'CONFIRMED',
    detalles: [
      { productoSku: 'PAP-CAN-002', cantidadKg: 50 },
      { productoSku: 'PAP-PER-005', cantidadKg: 15 },
    ],
  },
  {
    clienteIdx: 4,
    diasDesdeHoy: -1,
    fechaEntregaOffset: 1,
    estadoFinal: 'CONFIRMED',
    detalles: [{ productoSku: 'PAP-AMA-001', cantidadKg: 40 }],
  },
  {
    clienteIdx: 0,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 1,
    estadoFinal: 'CONFIRMED',
    detalles: [{ productoSku: 'PAP-YUN-003', cantidadKg: 60 }],
  },
  {
    clienteIdx: 2,
    diasDesdeHoy: -1,
    fechaEntregaOffset: 1,
    estadoFinal: 'CONFIRMED',
    detalles: [
      { productoSku: 'PAP-TUM-006', cantidadKg: 30 },
      { productoSku: 'PAP-NEG-008', cantidadKg: 10 },
    ],
  },
  // ─── 3 DISPATCHED (sin hoja, pero ya despachados — caso edge) ──────────
  // Estos 3 NO se asignan a la hoja EN_RUTA para no inflar el peso;
  // simulan pedidos que recién pasaron por DISPATCHED en otra hoja
  // que ya no existe (ej: hoja borrada o demo histórica).
  {
    clienteIdx: 6,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'DISPATCHED',
    detalles: [{ productoSku: 'PAP-CAN-002', cantidadKg: 80 }],
  },
  {
    clienteIdx: 8,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'DISPATCHED',
    detalles: [
      { productoSku: 'PAP-YUN-003', cantidadKg: 50 },
      { productoSku: 'PAP-AMA-001', cantidadKg: 20 },
    ],
  },
  {
    clienteIdx: 11,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'DISPATCHED',
    detalles: [{ productoSku: 'PAP-COL-007', cantidadKg: 45 }],
  },
  // ─── 4 ON_ROUTE (en hoja EN_RUTA — Lima Sur) ──────────────────────────
  {
    clienteIdx: 5,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'ON_ROUTE',
    detalles: [{ productoSku: 'PAP-YUN-003', cantidadKg: 100 }],
  },
  {
    clienteIdx: 6,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'ON_ROUTE',
    detalles: [
      { productoSku: 'PAP-CAN-002', cantidadKg: 70 },
      { productoSku: 'PAP-HUA-004', cantidadKg: 25 },
    ],
  },
  {
    clienteIdx: 7,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'ON_ROUTE',
    detalles: [{ productoSku: 'PAP-AMA-001', cantidadKg: 60 }],
  },
  {
    clienteIdx: 9,
    diasDesdeHoy: -2,
    fechaEntregaOffset: 0,
    estadoFinal: 'ON_ROUTE',
    detalles: [{ productoSku: 'PAP-PER-005', cantidadKg: 35 }],
  },
  // ─── 3 DELIVERED (con Entrega registrada) ─────────────────────────────
  {
    clienteIdx: 13,
    diasDesdeHoy: -3,
    fechaEntregaOffset: -1,
    estadoFinal: 'DELIVERED',
    detalles: [
      { productoSku: 'PAP-YUN-003', cantidadKg: 80 },
      { productoSku: 'PAP-CAN-002', cantidadKg: 30 },
    ],
  },
  {
    clienteIdx: 14,
    diasDesdeHoy: -4,
    fechaEntregaOffset: -2,
    estadoFinal: 'DELIVERED',
    detalles: [{ productoSku: 'PAP-AMA-001', cantidadKg: 55 }],
  },
  {
    clienteIdx: 1,
    diasDesdeHoy: -5,
    fechaEntregaOffset: -3,
    estadoFinal: 'DELIVERED',
    detalles: [{ productoSku: 'PAP-YUN-003', cantidadKg: 90 }],
  },
];

/** Cadena ordenada de transiciones de estado por destino final. */
const STATE_PATH: Record<PedidoSeed['estadoFinal'], string[]> = {
  REGISTERED: ['REGISTERED'],
  CONFIRMED: ['REGISTERED', 'CONFIRMED'],
  DISPATCHED: ['REGISTERED', 'CONFIRMED', 'DISPATCHED'],
  ON_ROUTE: ['REGISTERED', 'CONFIRMED', 'DISPATCHED', 'ON_ROUTE'],
  DELIVERED: ['REGISTERED', 'CONFIRMED', 'DISPATCHED', 'ON_ROUTE', 'DELIVERED'],
};

/** ID del usuario que registra cada transición según el estado destino. */
function actorParaTransicion(
  estadoNuevo: string,
  vendedorId: number,
  supervisorId: number,
  despachadorId: number,
  choferId: number,
): number {
  if (estadoNuevo === 'REGISTERED') return vendedorId;
  if (estadoNuevo === 'CONFIRMED') return supervisorId;
  if (estadoNuevo === 'DISPATCHED') return despachadorId;
  if (estadoNuevo === 'ON_ROUTE') return choferId;
  if (estadoNuevo === 'DELIVERED') return choferId;
  return vendedorId;
}

interface SeedTxResult {
  pedidosCreados: number;
  hojasCreadas: number;
  entregasCreadas: number;
  auditoriaCreada: number;
}

async function seedTransaccional(
  clienteIds: number[],
  productosBySku: Map<string, number>,
  rutasByNombre: Map<string, number>,
  vehiculosByPlaca: Map<string, number>,
  choferesByDni: Map<string, number>,
  usuariosByCorreo: Map<string, number>,
): Promise<SeedTxResult> {
  // Idempotencia: si ya hay pedidos, asumimos que el seed transaccional ya
  // corrió y NO insertamos de nuevo (evitamos romper estados manualmente
  // manipulados durante la demo).
  const existingPedidosCount = await prisma.pedido.count();
  if (existingPedidosCount > 0) {
    console.log(
      `  ⊘ pedidos ya existen (${existingPedidosCount}), skip transaccional`,
    );
    return {
      pedidosCreados: 0,
      hojasCreadas: 0,
      entregasCreadas: 0,
      auditoriaCreada: 0,
    };
  }

  const adminId = usuariosByCorreo.get('admin@lacosecha.com')!;
  const vendedorId = usuariosByCorreo.get('vendedor@lacosecha.com')!;
  const supervisorId = usuariosByCorreo.get('supervisor@lacosecha.com')!;
  const despachadorId = usuariosByCorreo.get('despacho@lacosecha.com')!;
  const choferId = usuariosByCorreo.get('chofer@lacosecha.com')!;

  const rutaLimaNorteId = rutasByNombre.get('Lima Norte')!;
  const rutaLimaSurId = rutasByNombre.get('Lima Sur')!;

  const vehiculoMedianoId = vehiculosByPlaca.get('BDG-456')!; // 1000 kg
  const vehiculoGrandeId = vehiculosByPlaca.get('CFK-789')!; // 1500 kg

  const choferDniArr = Array.from(choferesByDni.values());
  const choferAId = choferDniArr[0];
  const choferBId = choferDniArr[1];

  const hoy = new Date();

  // ───── 1) Crear pedidos + detalles + logs de estado ────────────────
  const pedidosCreadosPorEstado: Record<string, number[]> = {
    REGISTERED: [],
    CONFIRMED: [],
    DISPATCHED: [],
    ON_ROUTE: [],
    DELIVERED: [],
  };

  for (const seed of PEDIDOS_SEED) {
    const clienteId = clienteIds[seed.clienteIdx];
    if (clienteId === undefined) {
      throw new Error(`clienteIdx ${seed.clienteIdx} fuera de rango`);
    }
    const fechaCreacion = addDays(hoy, seed.diasDesdeHoy);
    const fechaEntrega = addDays(hoy, seed.fechaEntregaOffset);

    const pedido = await prisma.pedido.create({
      data: {
        clienteId,
        fechaEntrega,
        estado: seed.estadoFinal,
        observacion: seed.observacion,
        creadoPorId: vendedorId,
        fechaCreacion,
        detalles: {
          create: seed.detalles.map((d) => {
            const productoId = productosBySku.get(d.productoSku);
            if (productoId === undefined) {
              throw new Error(`Producto SKU ${d.productoSku} no encontrado`);
            }
            return { productoId, cantidad: d.cantidadKg };
          }),
        },
      },
    });

    pedidosCreadosPorEstado[seed.estadoFinal].push(pedido.id);

    // Crear EstadoPedidoLog para cada transición histórica.
    const transitions = STATE_PATH[seed.estadoFinal];
    let prev: string | null = null;
    let logFecha = fechaCreacion;
    for (const estadoNuevo of transitions) {
      await prisma.estadoPedidoLog.create({
        data: {
          pedidoId: pedido.id,
          estadoAnterior: prev,
          estadoNuevo,
          motivo:
            estadoNuevo === 'REGISTERED'
              ? 'Pedido registrado por vendedor'
              : estadoNuevo === 'CONFIRMED'
                ? 'Confirmado por supervisor'
                : estadoNuevo === 'DISPATCHED'
                  ? 'Asignado a hoja de carga'
                  : estadoNuevo === 'ON_ROUTE'
                    ? 'Hoja de carga en ruta'
                    : 'Entregado al cliente',
          usuarioId: actorParaTransicion(
            estadoNuevo,
            vendedorId,
            supervisorId,
            despachadorId,
            choferId,
          ),
          fechaCreacion: logFecha,
        },
      });
      prev = estadoNuevo;
      logFecha = addDays(logFecha, 0); // Misma fecha base; el orden lo da el id.
    }
  }

  const totalPedidos = Object.values(pedidosCreadosPorEstado).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );
  console.log(`  ✓ pedidos (${totalPedidos})`);

  // ───── 2) Hoja de carga PREPARANDO (Lima Norte) con los 5 CONFIRMED ──
  const idsConfirmed = pedidosCreadosPorEstado.CONFIRMED;
  const pedidosConfirmedConDetalle = await prisma.pedido.findMany({
    where: { id: { in: idsConfirmed } },
    include: { detalles: true },
  });
  const totalKgPreparando = pedidosConfirmedConDetalle.reduce(
    (acc, p) =>
      acc + p.detalles.reduce((sum, d) => sum + Number(d.cantidad), 0),
    0,
  );

  const hojaPreparando = await prisma.hojaCarga.create({
    data: {
      fecha: addDays(hoy, 1),
      rutaId: rutaLimaNorteId,
      vehiculoId: vehiculoMedianoId,
      choferId: choferAId,
      estado: 'PREPARANDO',
      totalKg: totalKgPreparando,
      creadoPorId: despachadorId,
      fechaCreacion: addDays(hoy, -1),
    },
  });
  await prisma.pedido.updateMany({
    where: { id: { in: idsConfirmed } },
    data: { hojaCargaId: hojaPreparando.id },
  });

  // ───── 3) Hoja de carga EN_RUTA (Lima Sur) con los 4 ON_ROUTE ────────
  const idsOnRoute = pedidosCreadosPorEstado.ON_ROUTE;
  const pedidosOnRouteConDetalle = await prisma.pedido.findMany({
    where: { id: { in: idsOnRoute } },
    include: { detalles: true },
  });
  const totalKgEnRuta = pedidosOnRouteConDetalle.reduce(
    (acc, p) =>
      acc + p.detalles.reduce((sum, d) => sum + Number(d.cantidad), 0),
    0,
  );

  const hojaEnRuta = await prisma.hojaCarga.create({
    data: {
      fecha: hoy,
      rutaId: rutaLimaSurId,
      vehiculoId: vehiculoGrandeId,
      choferId: choferBId,
      estado: 'EN_RUTA',
      totalKg: totalKgEnRuta,
      creadoPorId: despachadorId,
      fechaCreacion: addDays(hoy, -2),
    },
  });
  await prisma.pedido.updateMany({
    where: { id: { in: idsOnRoute } },
    data: { hojaCargaId: hojaEnRuta.id },
  });

  console.log(`  ✓ hojas de carga (2: PREPARANDO + EN_RUTA)`);

  // ───── 4) Entregas para los 3 DELIVERED ──────────────────────────────
  const idsDelivered = pedidosCreadosPorEstado.DELIVERED;
  let entregasCreadas = 0;
  for (const pedidoId of idsDelivered) {
    await prisma.entrega.create({
      data: {
        pedidoId,
        estado: 'ENTREGADO',
        observacion: 'Entrega conforme. Cliente firmó constancia.',
        registradoPorId: choferId,
        fechaEntrega: addDays(hoy, -1),
      },
    });
    entregasCreadas++;
  }
  console.log(`  ✓ entregas (${entregasCreadas})`);

  // ───── 5) RegistroAuditoria — 5 logs de creación de pedidos ──────────
  const primerosPedidos = await prisma.pedido.findMany({
    take: 5,
    orderBy: { id: 'asc' },
    select: { id: true, fechaCreacion: true },
  });
  let auditoriaCreada = 0;
  for (const p of primerosPedidos) {
    await prisma.registroAuditoria.create({
      data: {
        usuarioId: vendedorId,
        accion: 'CREAR',
        modulo: 'pedidos',
        entidadId: p.id,
        detalle: `Pedido #${p.id} creado por vendedor`,
        ip: '192.168.1.10',
        fechaCreacion: p.fechaCreacion,
      },
    });
    auditoriaCreada++;
  }
  // Un log adicional del admin (login).
  await prisma.registroAuditoria.create({
    data: {
      usuarioId: adminId,
      accion: 'LOGIN',
      modulo: 'auth',
      detalle: 'Inicio de sesión exitoso',
      ip: '192.168.1.1',
      fechaCreacion: hoy,
    },
  });
  auditoriaCreada++;
  console.log(`  ✓ auditoría (${auditoriaCreada})`);

  return {
    pedidosCreados: totalPedidos,
    hojasCreadas: 2,
    entregasCreadas,
    auditoriaCreada,
  };
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const start = Date.now();
  console.log('Starting seed...');

  await seedUbigeo();
  await seedEmpresa();
  await seedPermisosPorRol();
  const usuariosByCorreo = await seedUsuarios();

  const rutasByNombre = await seedRutas();
  const vehiculosByPlaca = await seedVehiculos();
  const choferesByDni = await seedChoferes();
  const productosBySku = await seedProductos();
  const clienteIds = await seedClientes(rutasByNombre);

  const tx = await seedTransaccional(
    clienteIds,
    productosBySku,
    rutasByNombre,
    vehiculosByPlaca,
    choferesByDni,
    usuariosByCorreo,
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`Seed completed in ${elapsed}s`);
  console.log(
    `  Resumen: ${tx.pedidosCreados} pedidos, ${tx.hojasCreadas} hojas, ${tx.entregasCreadas} entregas, ${tx.auditoriaCreada} auditorías`,
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
