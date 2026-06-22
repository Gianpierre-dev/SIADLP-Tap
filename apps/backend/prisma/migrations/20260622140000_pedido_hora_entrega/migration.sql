-- Hora programada de entrega del pedido (string "HH:MM", 24h). Nullable: los
-- pedidos existentes no la tienen. La fecha sigue manejando la planificación
-- por día; la hora es el objetivo de entrega que ve el chofer.
ALTER TABLE "pedidos" ADD COLUMN "hora_entrega" TEXT;
