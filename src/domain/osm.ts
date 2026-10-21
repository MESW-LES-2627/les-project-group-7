import { PlaceCategory } from "@prisma/client";
import { type PriceLevel } from "@/domain/rating";

export interface OsmTags {
  name?: string;
  tourism?: string;
  amenity?: string;
  historic?: string;
  leisure?: string;
  fee?: string;
  description?: string;
  "addr:street"?: string;
  "addr:housenumber"?: string;
  "addr:city"?: string;
  [key: string]: string | undefined;
}

/**
 * Maps raw OpenStreetMap tags to the canonical PlaceCategory enum.
 * Priority: Museum > Restaurant > Cafe > Bar > Park > Monument > Other.
 */
export function mapOsmCategory(tags?: OsmTags | null): PlaceCategory {
  if (!tags) {
    return PlaceCategory.OTHER;
  }

  if (tags.tourism === "museum") {
    return PlaceCategory.MUSEUM;
  }

  if (tags.amenity === "restaurant") {
    return PlaceCategory.RESTAURANT;
  }

  if (tags.amenity === "cafe") {
    return PlaceCategory.CAFE;
  }

  if (tags.amenity === "bar" || tags.amenity === "pub") {
    return PlaceCategory.BAR;
  }

  if (tags.leisure === "park" || tags.leisure === "garden") {
    return PlaceCategory.PARK;
  }

  if (
    tags.historic === "monument" ||
    tags.historic === "memorial" ||
    tags.tourism === "attraction" ||
    tags.tourism === "viewpoint"
  ) {
    return PlaceCategory.MONUMENT;
  }

  return PlaceCategory.OTHER;
}

/**
 * Maps OSM pricing / fee tags to our canonical PriceLevel.
 */
export function mapOsmPriceLevel(tags?: OsmTags | null): PriceLevel {
  if (!tags) {
    return "€";
  }

  if (tags.fee === "no" || tags.fee === "0") {
    return "FREE";
  }

  return "€";
}

/**
 * Formats street and house number into a human-readable address.
 */
export function formatOsmAddress(tags?: OsmTags | null, defaultCity = "Porto"): string {
  if (!tags) {
    return defaultCity;
  }

  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const parts = [street, number].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : defaultCity;
}

/**
 * Rounds bounding-box coordinates to ~100m grid (3 decimal places)
 * to maximize cache hits on subtle map pans.
 */
export function getQuantizedKey(
  south: number,
  west: number,
  north: number,
  east: number,
  precision = 3
): string {
  return `${south.toFixed(precision)}:${west.toFixed(precision)}:${north.toFixed(precision)}:${east.toFixed(precision)}`;
}
