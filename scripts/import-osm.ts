/**
 * The "Import places" command (US-B1-01): loads the places of one MVP city from OpenStreetMap
 * (Nominatim) into the database and into a snapshot file that the seed can load without a network.
 *
 *   npm run import:osm -- <city> [--dry-run]       cities: porto, paris, berlin
 *
 * Nothing is written, in the database or in the file, unless every request to OpenStreetMap
 * answered. The rules about what is saved (name, category, opening hours, price level) are in
 * src/domain/osm/osm.ts and are unit tested.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import {
  placeFromNominatim,
  type CityArea,
  type ImportedPlace,
} from "../src/domain/osm/osm";

const prisma = new PrismaClient();

interface CityConfig {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  area: CityArea;
  searches: string[];
}

/** The kinds of place that are searched for in every city. */
const KINDS = [
  "monument",
  "museum",
  "viewpoint",
  "attraction",
  "park",
  "garden",
  "church",
  "restaurant",
  "cafe",
  "bar",
];

const CITIES: Record<string, CityConfig> = {
  porto: {
    id: "city-porto",
    name: "Porto",
    country: "Portugal",
    latitude: 41.1579,
    longitude: -8.6291,
    area: {
      name: "Porto",
      minLat: 41.05,
      maxLat: 41.35,
      minLon: -8.75,
      maxLon: -8.45,
    },
    // The district of Porto also covers Vila Nova de Gaia and Matosinhos
    searches: [
      ...KINDS.map((kind) => `${kind} in Porto, Portugal`),
      "monument in Vila Nova de Gaia, Portugal",
      "viewpoint in Vila Nova de Gaia, Portugal",
      "park in Vila Nova de Gaia, Portugal",
      "monument in Matosinhos, Portugal",
      "park in Matosinhos, Portugal",
    ],
  },
  paris: {
    id: "city-paris",
    name: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    area: {
      name: "Paris",
      minLat: 48.815,
      maxLat: 48.902,
      minLon: 2.224,
      maxLon: 2.47,
    },
    searches: KINDS.map((kind) => `${kind} in Paris, France`),
  },
  berlin: {
    id: "city-berlim",
    name: "Berlin",
    country: "Germany",
    latitude: 52.52,
    longitude: 13.405,
    area: {
      name: "Berlin",
      minLat: 52.44,
      maxLat: 52.59,
      minLon: 13.25,
      maxLon: 13.55,
    },
    searches: KINDS.map((kind) => `${kind} in Berlin, Germany`),
  },
};

/** Asks Nominatim for one search. Any problem stops the whole import with a clear message. */
async function fetchFromOsm(query: string): Promise<unknown[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=50&addressdetails=1&extratags=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Tripbook/1.0 (feup-les-group7; student-project)",
        Accept: "application/json",
        // Nominatim reads words like "cafe" in the language of the request. Node sends
        // "Accept-Language: *" by default, and then "cafe in Paris" returns pubs.
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`OpenStreetMap did not answer for "${query}": ${reason}`);
  }

  if (!res.ok) {
    const hint =
      res.status === 429
        ? " (too many requests: wait a while and try again)"
        : "";
    throw new Error(
      `OpenStreetMap answered ${res.status} for "${query}"${hint}`
    );
  }

  const data: unknown = await res.json().catch(() => null);
  if (!Array.isArray(data)) {
    throw new Error(`OpenStreetMap sent an unexpected answer for "${query}"`);
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cityName = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
  const city = cityName ? CITIES[cityName] : undefined;

  if (!city || !cityName) {
    throw new Error(
      `Usage: npm run import:osm -- <city> [--dry-run]   (cities: ${Object.keys(CITIES).join(", ")})`
    );
  }

  console.log(
    `Importing the places of ${city.name} from OpenStreetMap${dryRun ? " (dry run: nothing will be written)" : ""}...`
  );

  // 1. Ask OpenStreetMap for everything first. If anything fails, nothing has been changed.
  const places = new Map<string, ImportedPlace>();
  for (let i = 0; i < city.searches.length; i++) {
    const query = city.searches[i];
    console.log(`[${i + 1}/${city.searches.length}] "${query}"`);
    const results = await fetchFromOsm(query);

    let added = 0;
    for (const item of results) {
      const place = placeFromNominatim(item, city.area);
      if (place && !places.has(place.osmId)) {
        places.set(place.osmId, place);
        added++;
      }
    }
    console.log(`    ${results.length} results, ${added} new places`);

    // Nominatim usage policy: at most 1 request per second
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  const list = Array.from(places.values());
  if (list.length === 0) {
    throw new Error("OpenStreetMap answered but no place could be saved");
  }

  const count = (pick: (place: ImportedPlace) => unknown) =>
    list.filter((place) => pick(place)).length;
  console.log(
    `\n${list.length} distinct places: ${count((p) => p.priceLevel === "FREE")} free (fee=no), ` +
      `${count((p) => p.openingHours)} with opening hours.`
  );
  const byCategory = new Map<string, number>();
  for (const place of list) {
    byCategory.set(place.category, (byCategory.get(place.category) ?? 0) + 1);
  }
  console.log(
    "By category: " +
      Array.from(byCategory.entries())
        .map(([category, n]) => `${category} ${n}`)
        .join(", ")
  );

  if (dryRun) {
    console.log("Dry run: nothing was written.");
    return;
  }

  // 2. The snapshot that the seed loads
  const file = path.join(process.cwd(), `prisma/data/${cityName}-places.json`);
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + "\n", "utf-8");
  console.log(`Saved the snapshot to ${file}`);

  // 3. The database: the same OpenStreetMap id is the same place, so a second run duplicates nothing
  const row = await prisma.city.upsert({
    where: { id: city.id },
    update: {},
    create: {
      id: city.id,
      name: city.name,
      country: city.country,
      latitude: city.latitude,
      longitude: city.longitude,
    },
  });

  // The price level of a place with reviews comes from its reviews, so the import leaves it alone
  const reviewed = new Set(
    (
      await prisma.place.findMany({
        where: {
          osmId: { in: list.map((place) => place.osmId) },
          reviews: { some: {} },
        },
        select: { osmId: true },
      })
    ).map((place) => place.osmId)
  );

  for (const place of list) {
    await prisma.place.upsert({
      where: { osmId: place.osmId },
      update: {
        name: place.name,
        category: place.category,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        openingHours: place.openingHours,
        ...(reviewed.has(place.osmId) ? {} : { priceLevel: place.priceLevel }),
      },
      create: { ...place, cityId: row.id, source: "IMPORTED" },
    });
  }

  console.log(`Saved ${list.length} places of ${city.name} into the database.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
