-- Keep historical online orders, but all new orders are paid in person.
ALTER TYPE "PaymentMethod" ADD VALUE 'POS_ON_DELIVERY';
ALTER TYPE "PaymentProvider" ADD VALUE 'POS';
ALTER TABLE restaurant_settings ALTER COLUMN "onlinePaymentsEnabled" SET DEFAULT false;
ALTER TABLE restaurant_settings ALTER COLUMN "cashOnDeliveryEnabled" SET DEFAULT true;
ALTER TABLE restaurant_settings ALTER COLUMN "cashOnPickupEnabled" SET DEFAULT true;
UPDATE restaurant_settings SET "onlinePaymentsEnabled" = false, "cashOnDeliveryEnabled" = true, "cashOnPickupEnabled" = true;
