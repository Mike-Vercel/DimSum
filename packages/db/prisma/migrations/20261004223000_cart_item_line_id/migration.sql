-- Cart lines are identified per cart: the same device line id can never clash across accounts.
DROP INDEX "cart_items_cartId_idx";

ALTER TABLE "cart_items" ADD COLUMN "lineId" UUID;
UPDATE "cart_items" SET "lineId" = "id";
ALTER TABLE "cart_items" ALTER COLUMN "lineId" SET NOT NULL;

CREATE UNIQUE INDEX "cart_items_cartId_lineId_key" ON "cart_items"("cartId", "lineId");
