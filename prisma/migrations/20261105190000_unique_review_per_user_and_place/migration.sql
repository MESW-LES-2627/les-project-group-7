-- One review per user and place (US-C1-01, #37).
--
-- The unique index below fails while a database holds two reviews of the same user on the same place,
-- and the old demo seed wrote such reviews (dev and prod were seeded with it). So this migration first
-- removes them: of the reviews of one user on one place, the oldest stays and the others are deleted.
-- The average rating and the review count that are stored on the places it touched are then
-- recalculated, because they counted the deleted reviews. Their price level is not touched: the next
-- review or the seed recalculates it (the rule of the most common level is in src/domain).
--
-- On a database without duplicates the first three statements change nothing.

-- 1. The places that have a repeated review
CREATE TEMPORARY TABLE "_places_with_repeated_reviews" AS
SELECT DISTINCT "placeId"
FROM "Review"
GROUP BY "userId", "placeId"
HAVING count(*) > 1;

-- 2. Delete the repeated reviews, keeping the oldest of each user and place
DELETE FROM "Review" r
USING (
  SELECT "id",
         row_number() OVER (PARTITION BY "userId", "placeId" ORDER BY "createdAt" ASC, "id" ASC) AS "position"
  FROM "Review"
) ranked
WHERE r."id" = ranked."id" AND ranked."position" > 1;

-- 3. Recalculate the stored average (rounded to 1 decimal, half up) and the count of those places
UPDATE "Place" p
SET "reviewCount" = totals."reviewCount",
    "averageRating" = totals."averageRating"
FROM (
  SELECT t."placeId",
         count(r."id")::int AS "reviewCount",
         round(avg(r."rating")::numeric, 1)::double precision AS "averageRating"
  FROM "_places_with_repeated_reviews" t
  LEFT JOIN "Review" r ON r."placeId" = t."placeId"
  GROUP BY t."placeId"
) totals
WHERE p."id" = totals."placeId";

DROP TABLE "_places_with_repeated_reviews";

-- 4. The rule itself
-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_placeId_key" ON "Review"("userId", "placeId");
