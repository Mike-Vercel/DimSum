-- New-order alert: a ringtone that keeps ringing until the order is accepted (default for everyone).
ALTER TABLE restaurant_settings ALTER COLUMN "newOrderSound" SET DEFAULT 'ringtone';
UPDATE restaurant_settings SET "newOrderSound" = 'ringtone' WHERE "newOrderSound" = 'chime';
