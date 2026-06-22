-- Campos de licencia de conducir (contexto Perú) para choferes.

-- AlterTable: nuevos campos obligatorios.
-- Se agregan con DEFAULT temporal para no romper filas existentes y luego se quita el default.
ALTER TABLE "choferes" ADD COLUMN "licencia_clase" TEXT NOT NULL DEFAULT 'A';
ALTER TABLE "choferes" ADD COLUMN "licencia_categoria" TEXT NOT NULL DEFAULT 'A-IIb';
ALTER TABLE "choferes" ADD COLUMN "fecha_revalidacion" DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE "choferes" ALTER COLUMN "licencia_clase" DROP DEFAULT;
ALTER TABLE "choferes" ALTER COLUMN "licencia_categoria" DROP DEFAULT;
ALTER TABLE "choferes" ALTER COLUMN "fecha_revalidacion" DROP DEFAULT;

-- licencia: pasa de opcional a obligatoria y única.
UPDATE "choferes" SET "licencia" = 'PEND' || "id" WHERE "licencia" IS NULL;
ALTER TABLE "choferes" ALTER COLUMN "licencia" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "choferes_licencia_key" ON "choferes"("licencia");
