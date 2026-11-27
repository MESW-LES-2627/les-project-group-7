import { haversineDistanceKm } from "./geo";

/**
 * The city the map of the home page shows, so the ranking can follow the map (#187): the city whose
 * centre is near the middle of the map, when the map is close enough to show one city. A map zoomed out
 * past a city, or over no city, shows all cities.
 */

/** How far from its centre the middle of the map can be and still be in the city (Matosinhos, Gaia). */
export const CITY_RADIUS_KM = 25;

/** Wider than this, the map shows more than a city. */
export const MAX_CITY_VIEW_KM = 60;

export interface MapArea {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The id of the city in view, or null for all cities. */
export function cityInView(
  area: MapArea,
  cities: readonly { id: string; latitude: number; longitude: number }[]
): string | null {
  const lat = (area.south + area.north) / 2;
  const lng = (area.west + area.east) / 2;
  const across = Math.max(
    haversineDistanceKm(lat, area.west, lat, area.east),
    haversineDistanceKm(area.south, lng, area.north, lng)
  );

  if (across > MAX_CITY_VIEW_KM) return null;

  let nearest: { id: string; km: number } | null = null;
  for (const city of cities) {
    const km = haversineDistanceKm(lat, lng, city.latitude, city.longitude);
    if (km <= CITY_RADIUS_KM && (!nearest || km < nearest.km)) {
      nearest = { id: city.id, km };
    }
  }

  return nearest?.id ?? null;
}
