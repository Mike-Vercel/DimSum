-- The review link imported from the previous platform was its own short link (a redirect to
-- Google's review page for the same place). Link Google directly.
UPDATE "restaurant_settings"
SET "googleReviewUrl" = 'https://search.google.com/local/writereview?placeid=' || "googlePlaceId"
WHERE "googleReviewUrl" LIKE 'https://app.brenvo.ai/%' AND "googlePlaceId" IS NOT NULL;
