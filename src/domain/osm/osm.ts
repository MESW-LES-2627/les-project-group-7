/**
 * Architecture Summary:
 * Pure domain translation layer between raw OpenStreetMap Overpass payloads
 * and the application's internal relational schema (`Place`).
 *
 * Domain Policies:
 * - Category Mapping: Ordered priority (Museum > Restaurant > Cafe > Bar > Park > Monument > Other).
 * - Fee to PriceLevel: `fee=no` tags map directly to `FREE` (0 cost points). Commercial nodes without explicit tags remain null for user reviews.
 * - Quantized Cache Key: Rounding bbox coordinates to ~100m grid for deterministic LRU cache hits.
 */

import { PlaceCategory } from "@prisma/client";
import { type PriceLevel } from "@/domain/reviews/rating";
import { type OsmSearchResult } from "@/types/search";

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
export function formatOsmAddress(
  tags?: OsmTags | null,
  defaultCity = "Porto"
): string {
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

export interface NominatimRawItem {
  place_id: number;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  addresstype?: string;
  /** [south, north, west, east] as text. */
  boundingbox?: string[];
  address?: {
    attraction?: string;
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    country?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Type guard verifying if an unknown value is an array of Nominatim items.
 */
export function isNominatimResponse(val: unknown): val is NominatimRawItem[] {
  if (!Array.isArray(val)) {
    return false;
  }

  return val.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "osm_id" in item &&
      "lat" in item &&
      "lon" in item &&
      "display_name" in item
  );
}

/**
 * Maps Nominatim class/type taxonomy to the canonical PlaceCategory enum.
 */
function mapNominatimCategory(
  osmClass?: string,
  osmType?: string
): PlaceCategory {
  if (
    osmClass === "historic" ||
    osmType === "monument" ||
    osmType === "memorial" ||
    osmType === "attraction"
  ) {
    return PlaceCategory.MONUMENT;
  }

  if (
    osmClass === "tourism" &&
    (osmType === "museum" || osmType === "gallery")
  ) {
    return PlaceCategory.MUSEUM;
  }

  if (
    osmClass === "tourism" &&
    (osmType === "attraction" || osmType === "viewpoint")
  ) {
    return PlaceCategory.MONUMENT;
  }

  if (osmClass === "amenity" && osmType === "restaurant") {
    return PlaceCategory.RESTAURANT;
  }

  if (
    osmClass === "amenity" &&
    (osmType === "cafe" || osmType === "coffee_shop")
  ) {
    return PlaceCategory.CAFE;
  }

  if (osmClass === "amenity" && (osmType === "bar" || osmType === "pub")) {
    return PlaceCategory.BAR;
  }

  if (osmClass === "leisure" && (osmType === "park" || osmType === "garden")) {
    return PlaceCategory.PARK;
  }

  return PlaceCategory.OTHER;
}

/**
 * Parses a raw Nominatim item into the canonical OsmSearchResult structure.
 * Returns null if essential coordinates or attributes are missing.
 */
export function parseNominatimResult(val: unknown): OsmSearchResult | null {
  if (typeof val !== "object" || val === null) {
    return null;
  }

  const item = val as Partial<NominatimRawItem>;
  if (!item.osm_id || !item.lat || !item.lon || !item.display_name) {
    return null;
  }

  const latNum = parseFloat(item.lat);
  const lonNum = parseFloat(item.lon);
  if (isNaN(latNum) || isNaN(lonNum)) {
    return null;
  }

  // Extract clean primary name: either explicit attraction name or first segment of display_name
  const primaryName =
    item.address?.attraction || item.display_name.split(",")[0].trim();

  // Extract clean street address or secondary location description
  const street = item.address?.road || "";
  const city = item.address?.city || item.address?.town || "";
  const addressParts = [street, city].filter(Boolean);
  const formattedAddress =
    addressParts.length > 0
      ? addressParts.join(", ")
      : item.display_name.split(",").slice(0, 3).join(", ");

  const category = mapNominatimCategory(item.class, item.type);

  const isCity =
    !!item.address?.country &&
    ["city", "town", "municipality"].includes(item.addresstype ?? "");
  const [south, north, west, east] = (item.boundingbox ?? []).map(Number);
  const hasBox = [south, north, west, east].every(Number.isFinite);

  return {
    osmId: item.osm_id.toString(),
    name: primaryName,
    category,
    address: formattedAddress,
    latitude: Number(latNum.toFixed(6)),
    longitude: Number(lonNum.toFixed(6)),
    type: item.type || item.class || "spot",
    ...(hasBox && { boundingBox: { south, west, north, east } }),
    ...(isCity && { isCity, country: item.address?.country }),
  };
}
