-- DropForeignKey
ALTER TABLE "detalle_ordenes_compra" DROP CONSTRAINT "detalle_ordenes_compra_orden_compra_id_fkey";

-- DropForeignKey
ALTER TABLE "insumos_produccion" DROP CONSTRAINT "insumos_produccion_item_inventario_id_fkey";

-- DropForeignKey
ALTER TABLE "insumos_produccion" DROP CONSTRAINT "insumos_produccion_orden_produccion_id_fkey";

-- DropForeignKey
ALTER TABLE "items_inventario" DROP CONSTRAINT "items_inventario_producto_id_fkey";

-- DropForeignKey
ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "movimientos_inventario_item_inventario_id_fkey";

-- DropForeignKey
ALTER TABLE "movimientos_inventario" DROP CONSTRAINT "movimientos_inventario_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_creado_por_id_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_compra" DROP CONSTRAINT "ordenes_compra_proveedor_id_fkey";

-- DropForeignKey
ALTER TABLE "ordenes_produccion" DROP CONSTRAINT "ordenes_produccion_creado_por_id_fkey";

-- DropForeignKey
ALTER TABLE "productos_produccion" DROP CONSTRAINT "productos_produccion_orden_produccion_id_fkey";

-- DropForeignKey
ALTER TABLE "productos_produccion" DROP CONSTRAINT "productos_produccion_producto_id_fkey";

-- AlterTable
ALTER TABLE "detalle_pedidos" DROP COLUMN "precio_unitario",
DROP COLUMN "subtotal";

-- AlterTable
ALTER TABLE "entregas" DROP COLUMN "metodo_pago",
DROP COLUMN "monto_cobrado",
DROP COLUMN "numero_comprobante";

-- AlterTable
ALTER TABLE "hojas_carga" DROP COLUMN "numero_gre",
DROP COLUMN "total_monto";

-- AlterTable
ALTER TABLE "pedidos" DROP COLUMN "total";

-- AlterTable
ALTER TABLE "productos" DROP COLUMN "precio_base",
DROP COLUMN "stock_minimo";

-- AlterTable
ALTER TABLE "rutas" DROP COLUMN "tarifa";

-- DropTable
DROP TABLE "detalle_ordenes_compra";

-- DropTable
DROP TABLE "insumos_produccion";

-- DropTable
DROP TABLE "items_inventario";

-- DropTable
DROP TABLE "movimientos_inventario";

-- DropTable
DROP TABLE "ordenes_compra";

-- DropTable
DROP TABLE "ordenes_produccion";

-- DropTable
DROP TABLE "productos_produccion";

-- DropTable
DROP TABLE "proveedores";

