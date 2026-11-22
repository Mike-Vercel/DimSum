-- "Thank you, leave a review" e-mail sent a few minutes after delivery: marker so it goes out once.
ALTER TABLE "orders" ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
