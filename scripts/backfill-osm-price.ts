/**
 * The "Backfill OpenStreetMap price" command (US-C2-01, #40): sets `Place.osmPriceLevel`, what
 * OpenStreetMap says about the price of a place, from the snapshots of the import (`prisma/data`).
 *
 *   npm run backfill:osm-price -- [--dry-run]
 *
 * The migration that adds the column copies every FREE place as a safe guess, but a place can be FREE
 * only because its reviews say so (about 250 of the 363 in the demo data). The snapshots hold the truth:
 * FREE for a place tagged `fee=no`, nothing for the others. The command sets that, then recalculates
 * the stored rating, count and price level of the places with reviews whose value changed, with the
 * same function as the review endpoints (ADR-010).
 *
 * Run it once, right after the migration is deployed. It is safe to run again (nothing changes the
 * second time), only changes places that are in a snapshot, and leaves reviews alone. A place that is
 * not in a snapshot (saved from the map) keeps the value it has. With --dry-run it only counts.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { osmPriceLevelOf } from "../src/domain/osm/osm";
import { refreshPlaceStats } from "../src/lib/place-stats";

// The transaction of one place takes several round trips to the database, which can pass the default 5 s on Neon
const prisma = new PrismaClient({
  transactionOptions: { timeout: 60_000, maxWait: 60_000 },
});

const CITIES = ["porto", "paris", "berlin"];

interface SnapshotPlace {
  osmId: string;
  priceLevel: string | null;
}

function readSnapshot(city: string): SnapshotPlace[] {
  const file = path.join(process.cwd(), "prisma/data", `${city}-places.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as SnapshotPlace[];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const wanted = new Map<string, "FREE" | null>();
  for (const city of CITIES) {
    for (const place of readSnapshot(city)) {
      wanted.set(place.osmId, osmPriceLevelOf(place.priceLevel));
    }
  }

  const places = await prisma.place.findMany({
    where: { osmId: { in: [...wanted.keys()] } },
    select: {
      id: true,
      osmId: true,
      osmPriceLevel: true,
      priceLevel: true,
      _count: { select: { reviews: true } },
    },
  });

  const changed = places.filter(
    (place) =>
      place.osmId !== null && place.osmPriceLevel !== wanted.get(place.osmId)
  );
  const toFree = changed.filter((place) => wanted.get(place.osmId!) === "FREE");
  const toNothing = changed.filter(
    (place) => wanted.get(place.osmId!) === null
  );

  console.log(
    `${places.length} places of the snapshots are in the database. ` +
      `${changed.length} need a new value: ${toFree.length} to FREE, ${toNothing.length} to nothing ` +
      `(${places.length - changed.length} are already right).`
  );

  if (dryRun) {
    console.log("--dry-run: nothing was written.");
    return;
  }

  let refreshed = 0;
  let priceChanged = 0;

  for (const place of changed) {
    await prisma.$transaction(async (tx) => {
      await tx.place.update({
        where: { id: place.id },
        data: { osmPriceLevel: wanted.get(place.osmId!) ?? null },
      });

      if (place._count.reviews > 0) {
        const after = await refreshPlaceStats(tx, place.id);
        refreshed++;
        if (after.priceLevel !== place.priceLevel) priceChanged++;
      }
    });
  }

  console.log(
    `Done. ${changed.length} places updated, ${refreshed} with reviews recalculated ` +
      `(${priceChanged} of them got another price level).`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
