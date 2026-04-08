-- DropForeignKey
ALTER TABLE "items_inventario" DROP CONSTRAINT "items_inventario_producto_id_fkey";

-- AddForeignKey
ALTER TABLE "items_inventario" ADD CONSTRAINT "items_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
