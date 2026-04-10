import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as path from 'path';
import * as fs from 'fs';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

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

async function seedUbigeo() {
  const scriptsDir = path.resolve(__dirname, '../../../scripts');

  const departamentos: DepRaw[] = JSON.parse(
    fs.readFileSync(
      path.join(scriptsDir, 'ubigeo_peru_2016_departamentos.json'),
      'utf-8',
    ),
  );

  const provincias: ProvRaw[] = JSON.parse(
    fs.readFileSync(
      path.join(scriptsDir, 'ubigeo_peru_2016_provincias.json'),
      'utf-8',
    ),
  );

  const distritos: DistRaw[] = JSON.parse(
    fs.readFileSync(
      path.join(scriptsDir, 'ubigeo_peru_2016_distritos.json'),
      'utf-8',
    ),
  );

  console.log(
    `Seeding ubigeo: ${departamentos.length} depts, ${provincias.length} provs, ${distritos.length} dists`,
  );

  // Departamentos
  await prisma.departamento.createMany({
    data: departamentos.map((d) => ({ id: d.id, nombre: d.name })),
    skipDuplicates: true,
  });
  console.log(`  ✓ departamentos`);

  // Provincias
  await prisma.provincia.createMany({
    data: provincias.map((p) => ({
      id: p.id,
      nombre: p.name,
      departamentoId: p.department_id,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✓ provincias`);

  // Distritos in batches of 500 to avoid query size limits
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

async function main() {
  console.log('Starting seed...');
  await seedUbigeo();
  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
