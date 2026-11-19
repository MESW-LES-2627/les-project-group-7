/**
 * Architecture Summary:
 * Pure domain translation layer between raw OpenStreetMap Overpass payloads
 * and the application's internal relational schema (`Place`).
 *
 * Domain Policies:
 * - Category Mapping: Ordered priority (Museum > Restaurant > Cafe > Bar > Park > Monument > Other).
 *   One mapping for everything that enters the catalog: the import script, the search box and the live map.
 * - Fee to PriceLevel: `fee=no` tags map directly to `FREE` (0 cost points). Every other place has no price
 *   level (null) until a review gives one: a price level is never guessed.
 * - Opening hours: only what OpenStreetMap says (`opening_hours`); null when it says nothing.
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
  opening_hours?: string;
  building?: string;
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

  if (tags.tourism === "museum" || tags.tourism === "gallery") {
    return PlaceCategory.MUSEUM;
  }

  if (tags.amenity === "restaurant") {
    return PlaceCategory.RESTAURANT;
  }

  if (tags.amenity === "cafe" || tags.amenity === "coffee_shop") {
    return PlaceCategory.CAFE;
  }

  if (tags.amenity === "bar" || tags.amenity === "pub") {
    return PlaceCategory.BAR;
  }

  if (tags.leisure === "park" || tags.leisure === "garden") {
    return PlaceCategory.PARK;
  }

  if (
    tags.historic ||
    tags.tourism === "attraction" ||
    tags.tourism === "viewpoint" ||
    tags.building === "church" ||
    tags.building === "cathedral"
  ) {
    return PlaceCategory.MONUMENT;
  }

  return PlaceCategory.OTHER;
}

/**
 * `FREE` only when OpenStreetMap says `fee=no` (or `fee=0`). Every other place has no price level
 * (null, "unknown") until a review gives one: the price is never guessed from the category.
 */
export function mapOsmPriceLevel(tags?: OsmTags | null): PriceLevel | null {
  return tags?.fee === "no" || tags?.fee === "0" ? "FREE" : null;
}

/**
 * What OpenStreetMap says about the price of a place, as it is kept in `Place.osmPriceLevel`: FREE for a
 * place tagged `fee=no`, and nothing for every other place (OpenStreetMap has no other price data, so
 * any other level did not come from it).
 */
export function osmPriceLevelOf(priceLevel?: string | null): "FREE" | null {
  return priceLevel === "FREE" ? "FREE" : null;
}

/**
 * The opening hours as OpenStreetMap writes them, or null when it has none (unknown: the app
 * cannot warn about closed places, and never invents hours).
 */
export function openingHoursFromTags(tags?: OsmTags | null): string | null {
  const hours = tags?.opening_hours?.trim();
  return hours ? hours : null;
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
  osm_type?: string;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  class?: string;
  type?: string;
  extratags?: Record<string, string>;
  address?: {
    attraction?: string;
    road?: string;
    house_number?: string;
    postcode?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
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
 * Parses a raw Nominatim item into the canonical OsmSearchResult structure.
 * Returns null if essential coordinates or attributes are missing.
 */
export function parseNominatimResult(val: unknown): OsmSearchResult | null {
  if (typeof val !== "object" || val === null) {
    return null;
  }

  const item = val as Partial<NominatimRawItem>;
  const osmId = formatOsmId(item.osm_type, item.osm_id);
  if (!osmId || !item.lat || !item.lon || !item.display_name) {
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

  const category = mapOsmCategory(nominatimTags(item));

  return {
    osmId,
    name: primaryName,
    category,
    address: formattedAddress,
    latitude: Number(latNum.toFixed(6)),
    longitude: Number(lonNum.toFixed(6)),
    type: item.type || item.class || "spot",
  };
}

const OSM_TYPES = ["node", "way", "relation"];

/**
 * The id of a place in the catalog (`Place.osmId`): the OpenStreetMap type and number, for example
 * `way/4242`. The number alone is not enough, because a node and a way can have the same number.
 * The import, the search box and the live map all use this one format, so that a place found by
 * any of them is the same place as the one that was imported. Null when the type or the number is
 * not valid.
 */
export function formatOsmId(
  type: string | null | undefined,
  id: number | string | null | undefined
): string | null {
  const number = String(id ?? "");
  if (!type || !OSM_TYPES.includes(type) || !/^[0-9]+$/.test(number)) {
    return null;
  }
  return `${type}/${number}`;
}

/**
 * The id that a place discovered on the map or in the search gets until it is saved (and then as
 * its id in the catalog).
 */
export function discoveredPlaceId(osmId: string): string {
  return `osm-${osmId.replace("/", "-")}`;
}

/** The inverse of `discoveredPlaceId`: `osm-way-4242` gives `way/4242`, anything else gives null. */
export function osmIdFromDiscoveredPlaceId(placeId: string): string | null {
  const match = /^osm-(node|way|relation)-([0-9]+)$/.exec(placeId);
  return match ? `${match[1]}/${match[2]}` : null;
}

/** The tags of a Nominatim item: its class and type (for example `tourism=museum`) and its extra tags. */
function nominatimTags(item: Partial<NominatimRawItem>): OsmTags {
  const tags: OsmTags = { ...item.extratags };
  if (item.class && item.type) {
    tags[item.class] = item.type;
  }
  return tags;
}

/** A street address from the address details of a Nominatim item, ending with the city. */
export function formatNominatimAddress(
  address: NominatimRawItem["address"],
  defaultCity: string
): string {
  if (!address) {
    return defaultCity;
  }

  const parts: string[] = [];
  if (address.road) {
    parts.push(
      address.house_number
        ? `${address.road} ${address.house_number}`
        : address.road
    );
  }
  if (address.postcode) {
    parts.push(address.postcode);
  }
  parts.push(
    address.city || address.town || address.municipality || defaultCity
  );
  return parts.join(", ");
}

export interface CityArea {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Cuts a city area into `rows` x `cols` equal tiles, north to south and west to east. A search by
 * kind returns at most 50 places, mostly the central ones, so the import also searches every tile
 * (Nominatim `viewbox`: left, top, right, bottom) to reach the whole city.
 */
export function gridTiles(
  area: CityArea,
  rows: number,
  cols: number
): { left: number; top: number; right: number; bottom: number }[] {
  const tiles = [];
  const height = (area.maxLat - area.minLat) / rows;
  const width = (area.maxLon - area.minLon) / cols;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        left: area.minLon + col * width,
        top: area.maxLat - row * height,
        right: area.minLon + (col + 1) * width,
        bottom: area.maxLat - (row + 1) * height,
      });
    }
  }
  return tiles;
}

/** A place ready to be saved by the import (US-B1-01). */
export interface ImportedPlace {
  osmId: string;
  name: string;
  description: string;
  category: PlaceCategory;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  priceLevel: PriceLevel | null;
}

/**
 * Turns one Nominatim result (asked with `extratags=1` and `addressdetails=1`) into a place of
 * the catalog, or null when it must not be saved: it has no name, no usable coordinates, no
 * OpenStreetMap id, or it lies outside the area of the city.
 */
export function placeFromNominatim(
  val: unknown,
  area: CityArea
): ImportedPlace | null {
  if (typeof val !== "object" || val === null) {
    return null;
  }

  const item = val as Partial<NominatimRawItem>;
  const name = item.name?.trim();
  const osmId = formatOsmId(item.osm_type, item.osm_id);
  if (!name || !osmId) {
    return null;
  }

  const latitude = parseFloat(item.lat ?? "");
  const longitude = parseFloat(item.lon ?? "");
  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }
  if (
    latitude < area.minLat ||
    latitude > area.maxLat ||
    longitude < area.minLon ||
    longitude > area.maxLon
  ) {
    return null;
  }

  const tags = nominatimTags(item);
  const kind = (item.type ?? "place").replace(/_/g, " ");

  return {
    osmId,
    name,
    description: `${name} (${kind}) in ${area.name}, listed on OpenStreetMap.`,
    category: mapOsmCategory(tags),
    address: formatNominatimAddress(item.address, area.name),
    latitude,
    longitude,
    openingHours: openingHoursFromTags(tags),
    priceLevel: mapOsmPriceLevel(tags),
  };
}
