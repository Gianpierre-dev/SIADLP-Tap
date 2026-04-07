-- CreateTable
CREATE TABLE "ordenes_produccion" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observacion" TEXT,
    "creado_por_id" INTEGER NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos_produccion" (
    "id" SERIAL NOT NULL,
    "orden_produccion_id" INTEGER NOT NULL,
    "item_inventario_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "costo_unitario" DECIMAL(10,2) NOT NULL,
    "costo_total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "insumos_produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_produccion" (
    "id" SERIAL NOT NULL,
    "orden_produccion_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "productos_produccion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos_produccion" ADD CONSTRAINT "insumos_produccion_orden_produccion_id_fkey" FOREIGN KEY ("orden_produccion_id") REFERENCES "ordenes_produccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos_produccion" ADD CONSTRAINT "insumos_produccion_item_inventario_id_fkey" FOREIGN KEY ("item_inventario_id") REFERENCES "items_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_produccion" ADD CONSTRAINT "productos_produccion_orden_produccion_id_fkey" FOREIGN KEY ("orden_produccion_id") REFERENCES "ordenes_produccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_produccion" ADD CONSTRAINT "productos_produccion_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
