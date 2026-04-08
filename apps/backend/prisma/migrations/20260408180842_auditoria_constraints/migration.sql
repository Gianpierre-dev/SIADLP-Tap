-- CreateIndex
CREATE INDEX "hojas_carga_vehiculo_id_idx" ON "hojas_carga"("vehiculo_id");

-- CreateIndex
CREATE INDEX "hojas_carga_chofer_id_idx" ON "hojas_carga"("chofer_id");

-- CreateIndex
CREATE INDEX "insumos_produccion_orden_produccion_id_idx" ON "insumos_produccion"("orden_produccion_id");

-- CreateIndex
CREATE INDEX "insumos_produccion_item_inventario_id_idx" ON "insumos_produccion"("item_inventario_id");

-- CreateIndex
CREATE UNIQUE INDEX "insumos_produccion_orden_produccion_id_item_inventario_id_key" ON "insumos_produccion"("orden_produccion_id", "item_inventario_id");

-- CreateIndex
CREATE INDEX "productos_produccion_orden_produccion_id_idx" ON "productos_produccion"("orden_produccion_id");

-- CreateIndex
CREATE INDEX "productos_produccion_producto_id_idx" ON "productos_produccion"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_produccion_orden_produccion_id_producto_id_key" ON "productos_produccion"("orden_produccion_id", "producto_id");

-- CreateIndex
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");
