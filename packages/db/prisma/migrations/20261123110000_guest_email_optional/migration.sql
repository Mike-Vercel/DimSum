-- Guests may order without an e-mail (they follow the order with push notifications and the tracking page).
ALTER TABLE "orders" ALTER COLUMN "customerEmail" DROP NOT NULL;
