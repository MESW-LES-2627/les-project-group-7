/**
 * The "Import places" command (US-B1-01): loads the places of one MVP city from OpenStreetMap
 * (Nominatim) into the database and into a snapshot file that the seed can load without a network.
 *
 *   npm run import:osm -- <city> [--dry-run]       cities: porto, paris, berlin
 *   npm run import:osm -- <city> --landmarks-only   only the named landmarks, added to the snapshot
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
  /** Famous places, searched by name: a search by kind returns only 50 places and misses many. */
  landmarks: string[];
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
    landmarks: [
      "Livraria Lello, Porto",
      "Ponte Luís I, Porto",
      "Café Santiago, Porto",
      "Café Majestic, Porto",
      "Catraio Craft Beer Shop, Porto",
      "Torre dos Clérigos, Porto",
      "Parque de Serralves, Porto",
      "Palácio da Bolsa, Porto",
      "Sé do Porto",
      "Casa da Música, Porto",
      "Fundação de Serralves, Porto",
      "Jardins do Palácio de Cristal, Porto",
      "Igreja de São Francisco, Porto",
      "Cais da Ribeira, Porto",
      "Fonte da Moura, Porto",
      "Mercado do Bolhão, Porto",
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
    // "cafe in Paris, France" returns bars, "cafe in Paris" returns cafes: Nominatim reads it differently
    searches: KINDS.map((kind) =>
      kind === "cafe" ? "cafe in Paris" : `${kind} in Paris, France`
    ),
    landmarks: [
      "Eiffel Tower, Paris",
      "Musée du Louvre, Paris",
      "Cathédrale Notre-Dame de Paris",
      "Arc de Triomphe, Paris",
      "Basilique du Sacré-Cœur, Paris",
      "Centre Pompidou, Paris",
      "Jardin du Luxembourg, Paris",
      "Panthéon, Paris",
      "Sainte-Chapelle, Paris",
      "Place de la Concorde, Paris",
      "Opéra Garnier, Paris",
      "Jardin des Tuileries, Paris",
      "Musée de l'Orangerie, Paris",
      "Moulin Rouge, Paris",
      "Cimetière du Père-Lachaise, Paris",
      "Pont Alexandre III, Paris",
      "Café de Flore, Paris",
      "Les Deux Magots, Paris",
      "Palais Garnier, Paris",
      "Musée Rodin, Paris",
    ],
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
    landmarks: [
      "Brandenburger Tor, Berlin",
      "Reichstagsgebäude, Berlin",
      "Museumsinsel, Berlin",
      "Berlin Cathedral",
      "East Side Gallery, Berlin",
      "Checkpoint Charlie, Berlin",
      "Fernsehturm, Berlin",
      "Memorial to the Murdered Jews of Europe, Berlin",
      "Schloss Charlottenburg, Berlin",
      "Victory Column, Berlin",
      "Neue Nationalgalerie, Berlin",
      "Kaiser-Wilhelm-Gedächtniskirche, Berlin",
      "Tempelhofer Feld, Berlin",
      "Mauerpark, Berlin",
      "Potsdamer Platz, Berlin",
      "Pergamonmuseum, Berlin",
      "Gemäldegalerie, Berlin",
      "Topography of Terror, Berlin",
      "Gendarmenmarkt, Berlin",
      "Hackescher Markt, Berlin",
    ],
  },
};

/** How many times one search is tried before the whole import stops, and the pause between tries. */
const ATTEMPTS = 4;
const PAUSE_MS = 8000;

/** One try. A problem (no answer, an error status, an answer that is not a list) throws. */
async function askNominatim(query: string, limit: number): Promise<unknown[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=${limit}&addressdetails=1&extratags=1`;

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

/**
 * Asks Nominatim for one search. The public service sometimes answers 503 or does not answer for a
 * moment, so a failed try is repeated after a pause. If every try fails, the whole import stops
 * with the last message, before anything was written.
 */
async function fetchFromOsm(query: string, limit: number): Promise<unknown[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await askNominatim(query, limit);
    } catch (err) {
      if (attempt === ATTEMPTS) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`    ${reason}; trying again in ${PAUSE_MS / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const landmarksOnly = args.includes("--landmarks-only");
  const cityName = args.find((arg) => !arg.startsWith("--"))?.toLowerCase();
  const city = cityName ? CITIES[cityName] : undefined;

  if (!city || !cityName) {
    throw new Error(
      `Usage: npm run import:osm -- <city> [--dry-run] [--landmarks-only]   (cities: ${Object.keys(CITIES).join(", ")})`
    );
  }

  console.log(
    `Importing the places of ${city.name} from OpenStreetMap${dryRun ? " (dry run: nothing will be written)" : ""}...`
  );

  // 1. Ask OpenStreetMap for everything first. If anything fails, nothing has been changed.
  const file = path.join(process.cwd(), `prisma/data/${cityName}-places.json`);
  const places = new Map<string, ImportedPlace>();

  // Landmarks only: the places already in the snapshot stay, the landmarks are added to them
  if (landmarksOnly && fs.existsSync(file)) {
    for (const place of JSON.parse(
      fs.readFileSync(file, "utf-8")
    ) as ImportedPlace[]) {
      places.set(place.osmId, place);
    }
    console.log(`${places.size} places are already in the snapshot.`);
  }

  // A search by kind asks for 50 results, a search by name for the best match
  const searches = [
    ...(landmarksOnly
      ? []
      : city.searches.map((query) => ({ query, limit: 50 }))),
    ...city.landmarks.map((query) => ({ query, limit: 1 })),
  ];
  for (let i = 0; i < searches.length; i++) {
    const { query, limit } = searches[i];
    console.log(`[${i + 1}/${searches.length}] "${query}"`);
    const results = await fetchFromOsm(query, limit);

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
