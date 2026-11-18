import type { CityArea } from "./osm";

/**
 * The area of each city of the MVP (Porto, Paris, Berlin), by the id of the city. The import of the
 * places (US-B1-01) saves only places inside it, and a place found on the map is added to a trip only
 * if it is inside the area of the trip's city (US-E4-01).
 */
export const CITY_AREAS = {
  // The zone that the app covers: from Perafita in the north to Vilar do Paraíso in the south, with
  // the Douro and the coast, and no more (the airport, Maia or Valongo are outside)
  "city-porto": {
    name: "Porto",
    minLat: 41.08,
    maxLat: 41.24,
    minLon: -8.73,
    maxLon: -8.56,
  },
  "city-paris": {
    name: "Paris",
    minLat: 48.815,
    maxLat: 48.902,
    minLon: 2.224,
    maxLon: 2.47,
  },
  "city-berlim": {
    name: "Berlin",
    minLat: 52.44,
    maxLat: 52.59,
    minLon: 13.25,
    maxLon: 13.55,
  },
} as const satisfies Record<string, CityArea>;

/** The area of a city, or `null` when the city has none (a city that is not one of the MVP's). */
export function areaOfCity(cityId: string): CityArea | null {
  return Object.hasOwn(CITY_AREAS, cityId)
    ? CITY_AREAS[cityId as keyof typeof CITY_AREAS]
    : null;
}
