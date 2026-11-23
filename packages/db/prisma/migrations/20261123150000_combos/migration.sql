-- Combos: several dishes at a special price. Non-destructive: one new column, one new table.
ALTER TABLE "products" ADD COLUMN "isCombo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "combo_items" (
    "id" UUID NOT NULL,
    "comboId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "combo_items_comboId_productId_key" ON "combo_items"("comboId", "productId");
CREATE INDEX "combo_items_productId_idx" ON "combo_items"("productId");

ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_comboId_fkey" FOREIGN KEY ("comboId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
