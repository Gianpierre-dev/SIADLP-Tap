-- CreateIndex
CREATE INDEX "clientes_ruta_id_idx" ON "clientes"("ruta_id");

-- CreateIndex
CREATE INDEX "detalle_ordenes_compra_orden_compra_id_idx" ON "detalle_ordenes_compra"("orden_compra_id");

-- CreateIndex
CREATE INDEX "detalle_pedidos_pedido_id_idx" ON "detalle_pedidos"("pedido_id");

-- CreateIndex
CREATE INDEX "detalle_pedidos_producto_id_idx" ON "detalle_pedidos"("producto_id");

-- CreateIndex
CREATE INDEX "entregas_estado_idx" ON "entregas"("estado");

-- CreateIndex
CREATE INDEX "entregas_fecha_entrega_idx" ON "entregas"("fecha_entrega");

-- CreateIndex
CREATE INDEX "estado_pedido_logs_pedido_id_idx" ON "estado_pedido_logs"("pedido_id");

-- CreateIndex
CREATE INDEX "estado_pedido_logs_usuario_id_idx" ON "estado_pedido_logs"("usuario_id");

-- CreateIndex
CREATE INDEX "hojas_carga_fecha_idx" ON "hojas_carga"("fecha");

-- CreateIndex
CREATE INDEX "hojas_carga_estado_idx" ON "hojas_carga"("estado");

-- CreateIndex
CREATE INDEX "hojas_carga_ruta_id_idx" ON "hojas_carga"("ruta_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_item_inventario_id_idx" ON "movimientos_inventario"("item_inventario_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_fecha_creacion_idx" ON "movimientos_inventario"("fecha_creacion");

-- CreateIndex
CREATE INDEX "ordenes_compra_proveedor_id_idx" ON "ordenes_compra"("proveedor_id");

-- CreateIndex
CREATE INDEX "ordenes_compra_estado_idx" ON "ordenes_compra"("estado");

-- CreateIndex
CREATE INDEX "ordenes_compra_fecha_creacion_idx" ON "ordenes_compra"("fecha_creacion");

-- CreateIndex
CREATE INDEX "ordenes_produccion_fecha_idx" ON "ordenes_produccion"("fecha");

-- CreateIndex
CREATE INDEX "ordenes_produccion_estado_idx" ON "ordenes_produccion"("estado");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- CreateIndex
CREATE INDEX "pedidos_fecha_entrega_idx" ON "pedidos"("fecha_entrega");

-- CreateIndex
CREATE INDEX "pedidos_hoja_carga_id_idx" ON "pedidos"("hoja_carga_id");

-- CreateIndex
CREATE INDEX "pedidos_fecha_creacion_idx" ON "pedidos"("fecha_creacion");

-- CreateIndex
CREATE INDEX "registro_auditoria_usuario_id_idx" ON "registro_auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "registro_auditoria_modulo_idx" ON "registro_auditoria"("modulo");

-- CreateIndex
CREATE INDEX "registro_auditoria_fecha_creacion_idx" ON "registro_auditoria"("fecha_creacion");
