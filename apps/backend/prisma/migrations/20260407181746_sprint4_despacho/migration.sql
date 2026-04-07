-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "hoja_carga_id" INTEGER;

-- CreateTable
CREATE TABLE "hojas_carga" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "ruta_id" INTEGER NOT NULL,
    "vehiculo_id" INTEGER NOT NULL,
    "chofer_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PREPARANDO',
    "numero_gre" TEXT,
    "total_kg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_monto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "creado_por_id" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojas_carga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "monto_cobrado" DECIMAL(10,2),
    "metodo_pago" TEXT,
    "numero_comprobante" TEXT,
    "observacion" TEXT,
    "registrado_por_id" INTEGER NOT NULL,
    "fecha_entrega" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entregas_pedido_id_key" ON "entregas"("pedido_id");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_hoja_carga_id_fkey" FOREIGN KEY ("hoja_carga_id") REFERENCES "hojas_carga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojas_carga" ADD CONSTRAINT "hojas_carga_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "rutas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojas_carga" ADD CONSTRAINT "hojas_carga_vehiculo_id_fkey" FOREIGN KEY ("vehiculo_id") REFERENCES "vehiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojas_carga" ADD CONSTRAINT "hojas_carga_chofer_id_fkey" FOREIGN KEY ("chofer_id") REFERENCES "choferes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojas_carga" ADD CONSTRAINT "hojas_carga_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
