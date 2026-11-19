-- What OpenStreetMap says about the price of a place (US-C2-01, #40): FREE for a place tagged fee=no, else nothing.
-- Reviews change Place.priceLevel, so once a review is edited or deleted the place needs a starting point that the
-- reviews never touch, to go back to. A new nullable column, nothing is deleted.
ALTER TABLE "Place" ADD COLUMN "osmPriceLevel" TEXT;

-- A place that is FREE now keeps being treated as free, so that this migration changes no behaviour. It is a
-- safe guess, not the truth: a place can also be FREE only because its reviews say so. `npm run backfill:osm-price`
-- sets the exact value from the import snapshots, and has to be run after this migration is deployed.
UPDATE "Place" SET "osmPriceLevel" = 'FREE' WHERE "priceLevel" = 'FREE';
