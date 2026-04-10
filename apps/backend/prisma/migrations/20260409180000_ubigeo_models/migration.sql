-- AlterTable: remove flat ubigeo string, add normalized FK columns
ALTER TABLE "clientes" DROP COLUMN IF EXISTS "ubigeo",
ADD COLUMN     "departamento_id" VARCHAR(2),
ADD COLUMN     "distrito_id" VARCHAR(6),
ADD COLUMN     "provincia_id" VARCHAR(4);

-- CreateTable
CREATE TABLE "departamentos" (
    "id" VARCHAR(2) NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provincias" (
    "id" VARCHAR(4) NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamento_id" VARCHAR(2) NOT NULL,

    CONSTRAINT "provincias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distritos" (
    "id" VARCHAR(6) NOT NULL,
    "nombre" TEXT NOT NULL,
    "provincia_id" VARCHAR(4) NOT NULL,
    "departamento_id" VARCHAR(2) NOT NULL,

    CONSTRAINT "distritos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provincias_departamento_id_idx" ON "provincias"("departamento_id");

-- CreateIndex
CREATE INDEX "distritos_provincia_id_idx" ON "distritos"("provincia_id");

-- CreateIndex
CREATE INDEX "distritos_departamento_id_idx" ON "distritos"("departamento_id");

-- CreateIndex
CREATE INDEX "clientes_departamento_id_idx" ON "clientes"("departamento_id");

-- CreateIndex
CREATE INDEX "clientes_provincia_id_idx" ON "clientes"("provincia_id");

-- CreateIndex
CREATE INDEX "clientes_distrito_id_idx" ON "clientes"("distrito_id");

-- AddForeignKey
ALTER TABLE "provincias" ADD CONSTRAINT "provincias_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distritos" ADD CONSTRAINT "distritos_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_provincia_id_fkey" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
