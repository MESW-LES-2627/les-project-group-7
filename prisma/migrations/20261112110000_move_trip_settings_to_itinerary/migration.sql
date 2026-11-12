-- A trip is only a city and dates. The budget level and the hour limits are optional settings of its
-- itinerary, and the types of place are only an input of the generator (US-E1-01, US-E4-01, US-E8-01).
-- Each trip gets an itinerary, created empty together with it. No trip exists on dev or prod yet, and
-- this keeps the settings of any trip that does exist.

ALTER TABLE "Itinerary" ADD COLUMN "budgetLevel" TEXT,
ADD COLUMN "dayStart" TEXT,
ADD COLUMN "dayEnd" TEXT;

-- A trip that already has an itinerary: copy its settings
UPDATE "Itinerary" i
SET "budgetLevel" = t."budgetLevel", "dayStart" = t."dayStart", "dayEnd" = t."dayEnd"
FROM "Trip" t
WHERE i."tripId" = t."id";

-- A trip without one: create it, empty, with its settings
INSERT INTO "Itinerary" ("id", "mode", "createdAt", "tripId", "budgetLevel", "dayStart", "dayEnd")
SELECT gen_random_uuid()::text, 'MANUAL', CURRENT_TIMESTAMP, t."id", t."budgetLevel", t."dayStart", t."dayEnd"
FROM "Trip" t
WHERE NOT EXISTS (SELECT 1 FROM "Itinerary" i WHERE i."tripId" = t."id");

ALTER TABLE "Trip" DROP COLUMN "budgetLevel",
DROP COLUMN "dayStart",
DROP COLUMN "dayEnd",
DROP COLUMN "allowedCategories";
