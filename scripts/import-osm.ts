import { PrismaClient, PlaceCategory } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface NominatimPlace {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name: string;
  display_name: string;
  class: string;
  type: string;
  address?: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    postcode?: string;
    country?: string;
  };
}

interface CuratedPlace {
  osmId: string;
  name: string;
  description: string;
  category: PlaceCategory;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: string;
  priceLevel: string;
}

/**
 * Maps Nominatim OSM classification to our PlaceCategory enum
 */
function classifyOsmCategory(osmClass: string, osmType: string): PlaceCategory {
  if (osmType === "museum" || osmClass === "museum")
    return PlaceCategory.MUSEUM;
  if (osmType === "restaurant" || osmClass === "restaurant")
    return PlaceCategory.RESTAURANT;
  if (osmType === "cafe" || osmClass === "cafe") return PlaceCategory.CAFE;
  if (osmType === "bar" || osmType === "pub" || osmClass === "bar")
    return PlaceCategory.BAR;
  if (osmType === "park" || osmType === "garden" || osmClass === "park")
    return PlaceCategory.PARK;
  if (
    osmType === "monument" ||
    osmType === "memorial" ||
    osmType === "viewpoint" ||
    osmType === "attraction" ||
    osmType === "church" ||
    osmType === "cathedral" ||
    osmType === "castle" ||
    osmClass === "historic"
  ) {
    return PlaceCategory.MONUMENT;
  }
  return PlaceCategory.OTHER;
}

/**
 * Formats a clean street address from OSM address details
 */
function formatAddress(item: NominatimPlace, defaultCity = "Porto"): string {
  const a = item.address;
  if (!a) return defaultCity;

  const parts: string[] = [];
  if (a.road) {
    parts.push(a.house_number ? `${a.road} ${a.house_number}` : a.road);
  }
  if (a.postcode) {
    parts.push(a.postcode);
  }
  const cityName = a.city || a.town || a.municipality || defaultCity;
  parts.push(cityName);

  return parts.length > 0 ? parts.join(", ") : defaultCity;
}

/**
 * Infers an appropriate price level
 */
function inferPriceLevel(cat: PlaceCategory, osmType: string): string {
  if (
    cat === PlaceCategory.PARK ||
    osmType === "viewpoint" ||
    osmType === "memorial"
  ) {
    return "FREE";
  }
  if (cat === PlaceCategory.MUSEUM || cat === PlaceCategory.MONUMENT) {
    return "€";
  }
  if (cat === PlaceCategory.RESTAURANT) {
    return "€€";
  }
  if (cat === PlaceCategory.CAFE) {
    return "€";
  }
  if (cat === PlaceCategory.BAR) {
    return "€€";
  }
  return "€";
}

function isNominatimPlace(val: unknown): val is NominatimPlace {
  if (typeof val !== "object" || val === null) {
    return false;
  }

  return (
    "lat" in val &&
    typeof val.lat === "string" &&
    "lon" in val &&
    typeof val.lon === "string" &&
    "osm_id" in val &&
    typeof val.osm_id === "number" &&
    "osm_type" in val &&
    typeof val.osm_type === "string"
  );
}

async function fetchFromOsm(query: string): Promise<NominatimPlace[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=50&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Tripbook/1.0 (feup-les-group7; student-project)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.warn(
        `Warning: Nominatim responded with status ${res.status} for "${query}"`
      );
      return [];
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter(isNominatimPlace);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(`Failed to fetch query "${query}":`, errorMessage);
    return [];
  }
}

async function main() {
  console.log("Ingesting OpenStreetMap points for Porto District...");

  // 1. Ensure Porto City exists in database
  const porto = await prisma.city.upsert({
    where: { id: "city-porto" },
    update: {},
    create: {
      id: "city-porto",
      name: "Porto",
      country: "Portugal",
      latitude: 41.1579,
      longitude: -8.6291,
    },
  });

  // Queries to sample broad categories across Porto and adjacent district hubs (Gaia, Matosinhos)
  const searchQueries = [
    "monument in Porto, Portugal",
    "museum in Porto, Portugal",
    "viewpoint in Porto, Portugal",
    "attraction in Porto, Portugal",
    "park in Porto, Portugal",
    "garden in Porto, Portugal",
    "historic in Porto, Portugal",
    "church in Porto, Portugal",
    "restaurant in Porto, Portugal",
    "cafe in Porto, Portugal",
    "bar in Porto, Portugal",
    "monument in Vila Nova de Gaia, Portugal",
    "viewpoint in Vila Nova de Gaia, Portugal",
    "park in Vila Nova de Gaia, Portugal",
    "monument in Matosinhos, Portugal",
    "park in Matosinhos, Portugal",
  ];

  const uniquePlaces = new Map<string, CuratedPlace>();

  // District of Porto bounding box
  const MIN_LAT = 41.05;
  const MAX_LAT = 41.35;
  const MIN_LON = -8.75;
  const MAX_LON = -8.45;

  for (let i = 0; i < searchQueries.length; i++) {
    const q = searchQueries[i];
    console.log(
      `[${i + 1}/${searchQueries.length}] Fetching "${q}" from OpenStreetMap...`
    );
    const results = await fetchFromOsm(q);

    for (const item of results) {
      if (!item.name || item.name.trim().length === 0) continue;

      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      if (isNaN(lat) || isNaN(lon)) continue;

      // Filter within Porto district boundaries
      if (lat < MIN_LAT || lat > MAX_LAT || lon < MIN_LON || lon > MAX_LON)
        continue;

      const osmId = `${item.osm_type}/${item.osm_id}`;
      if (uniquePlaces.has(osmId)) continue;

      const category = classifyOsmCategory(item.class, item.type);
      const address = formatAddress(item, "Porto");
      const priceLevel = inferPriceLevel(category, item.type);

      uniquePlaces.set(osmId, {
        osmId,
        name: item.name.trim(),
        description: `${item.name} (${item.type.replace(/_/g, " ")}) no distrito do Porto, referenciado no OpenStreetMap.`,
        category,
        address,
        latitude: lat,
        longitude: lon,
        openingHours: "Mo-Su 09:00-19:00",
        priceLevel,
      });
    }

    // Respect Nominatim Usage Policy (1 request per second)
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  const placesList = Array.from(uniquePlaces.values());
  console.log(
    `\nSucceeded! Fetched ${placesList.length} distinct places directly from OpenStreetMap.`
  );

  // 2. Persist to prisma/data/porto-places.json
  const dataPath = path.join(process.cwd(), "prisma/data/porto-places.json");
  fs.writeFileSync(dataPath, JSON.stringify(placesList, null, 2), "utf-8");
  console.log(`Saved ${placesList.length} places to ${dataPath}`);

  // 3. Upsert directly into PostgreSQL database
  console.log("Storing places into PostgreSQL database...");
  let inserted = 0;
  for (const p of placesList) {
    await prisma.place.upsert({
      where: { osmId: p.osmId },
      update: {
        name: p.name,
        category: p.category,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        priceLevel: p.priceLevel,
      },
      create: {
        osmId: p.osmId,
        name: p.name,
        description: p.description,
        category: p.category,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        openingHours: p.openingHours,
        priceLevel: p.priceLevel,
        cityId: porto.id,
        source: "IMPORTED",
      },
    });
    inserted++;
  }

  console.log(
    `Successfully synchronized ${inserted} OpenStreetMap places into PostgreSQL!`
  );
}

main()
  .catch((e) => {
    console.error("Error running OpenStreetMap import:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
