-- AlterTable
ALTER TABLE "items_inventario" ADD COLUMN     "producto_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "items_inventario_producto_id_key" ON "items_inventario"("producto_id");

-- AddForeignKey
ALTER TABLE "items_inventario" ADD CONSTRAINT "items_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
