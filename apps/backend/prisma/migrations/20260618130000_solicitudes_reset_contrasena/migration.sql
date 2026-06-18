-- CreateTable
CREATE TABLE "solicitudes_reset_contrasena" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "motivo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "aprobador_id" INTEGER,
    "motivo_rechazo" TEXT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesamiento" TIMESTAMP(3),

    CONSTRAINT "solicitudes_reset_contrasena_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_reset_contrasena_estado_idx" ON "solicitudes_reset_contrasena"("estado");

-- CreateIndex
CREATE INDEX "solicitudes_reset_contrasena_usuario_id_idx" ON "solicitudes_reset_contrasena"("usuario_id");

-- AddForeignKey
ALTER TABLE "solicitudes_reset_contrasena" ADD CONSTRAINT "solicitudes_reset_contrasena_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_reset_contrasena" ADD CONSTRAINT "solicitudes_reset_contrasena_aprobador_id_fkey" FOREIGN KEY ("aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
