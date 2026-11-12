-- The dates and times of a trip are local to its city, so each city needs its time zone (US-E1-01, #7).
-- A new column, nothing is deleted. A city that is not listed below keeps UTC until it is set.
ALTER TABLE "City" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';

UPDATE "City" SET "timezone" = 'Europe/Lisbon' WHERE "id" = 'city-porto';
UPDATE "City" SET "timezone" = 'Europe/Paris' WHERE "id" = 'city-paris';
UPDATE "City" SET "timezone" = 'Europe/Berlin' WHERE "id" = 'city-berlim';
