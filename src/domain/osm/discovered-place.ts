import { PlaceCategory } from "@prisma/client";
import { isPriceLevel, type PriceLevel } from "../reviews/rating";
import { isInsideArea, osmIdFromDiscoveredPlaceId } from "./osm";
import type { CityArea } from "./osm";

/**
 * A place found on the map or in the search that is not in the catalog yet (US-E4-01, #60). Its id is
 * `osm-node-123`, made from its OpenStreetMap id, and it is saved in the catalog the first time it is
 * added to a trip, as a place of the trip's city.
 *
 * The data comes from the browser, so it is checked here: the id has to be an OpenStreetMap id, the
 * name and the position have to be real, and the position has to be inside the area of the trip's
 * city. A place outside it is refused, so a trip never holds a place of another city (AC6).
 */

export const PLACE_NAME_MAX_LENGTH = 200;
export const PLACE_ADDRESS_MAX_LENGTH = 300;

export interface DiscoveredPlace {
  id: string;
  osmId: string;
  name: string;
  address: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  priceLevel: PriceLevel | null;
}

export type DiscoveredPlaceResult =
  | { ok: true; value: DiscoveredPlace }
  | {
      ok: false;
      /** NO_DATA: nothing to save the place from. INVALID: wrong data. OTHER_CITY: outside the city. */
      reason: "NO_DATA" | "INVALID" | "OTHER_CITY";
      error: string;
    };

function isCategory(value: unknown): value is PlaceCategory {
  return typeof value === "string" && Object.hasOwn(PlaceCategory, value);
}

function isCoordinate(value: unknown, limit: number): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= limit
  );
}

/**
 * Checks a place found on the map before it is saved.
 *
 * @param placeId the id the map gave it, like `osm-node-123`
 * @param raw the place as the browser sends it: `name`, `latitude`, `longitude` and, if known,
 * `address`, `category` and `priceLevel`
 * @param area the area of the city of the trip, or `null` if that city has none
 */
export function parseDiscoveredPlace(
  placeId: string,
  raw: unknown,
  area: CityArea | null
): DiscoveredPlaceResult {
  const osmId = osmIdFromDiscoveredPlaceId(placeId);
  if (osmId === null) {
    return { ok: false, reason: "NO_DATA", error: "This place does not exist" };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      reason: "NO_DATA",
      error:
        "This place is not in the catalog yet: send its data (name and position) to add it",
    };
  }

  const place = raw as Record<string, unknown>;

  const name = typeof place.name === "string" ? place.name.trim() : "";
  if (name === "" || name.length > PLACE_NAME_MAX_LENGTH) {
    return {
      ok: false,
      reason: "INVALID",
      error: `The place needs a name of 1 to ${PLACE_NAME_MAX_LENGTH} characters`,
    };
  }

  const { latitude, longitude } = place;
  if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) {
    return {
      ok: false,
      reason: "INVALID",
      error: "The place needs a real position (latitude and longitude)",
    };
  }

  if (area === null) {
    return {
      ok: false,
      reason: "OTHER_CITY",
      error: "Places found on the map cannot be added to a trip in this city",
    };
  }
  if (!isInsideArea(area, latitude, longitude)) {
    return {
      ok: false,
      reason: "OTHER_CITY",
      error: `This place is outside ${area.name}, the city of the trip`,
    };
  }

  const address =
    typeof place.address === "string" && place.address.trim() !== ""
      ? place.address.trim().slice(0, PLACE_ADDRESS_MAX_LENGTH)
      : area.name;

  return {
    ok: true,
    value: {
      id: placeId,
      osmId,
      name,
      address,
      category: isCategory(place.category)
        ? place.category
        : PlaceCategory.OTHER,
      latitude,
      longitude,
      priceLevel: isPriceLevel(place.priceLevel) ? place.priceLevel : null,
    },
  };
}
