/**
 * The body of POST /api/cities: a city to add to the catalog. Pure function, so the route only
 * deals with HTTP and the database.
 */

export interface NewCity {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

/** About 10 km around the centre: the catalog stores no outline for a city, this shows it whole. */
export function cityBounds(latitude: number, longitude: number) {
  return {
    south: latitude - 0.07,
    north: latitude + 0.07,
    west: longitude - 0.1,
    east: longitude + 0.1,
  };
}

const TEXT_MAX = 100;

const asText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/** The city, or null if any field is missing, too long or out of range. */
export function parseNewCity(body: unknown): NewCity | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const input = body as Record<string, unknown>;
  const name = asText(input.name);
  const country = asText(input.country);
  const { latitude, longitude } = input;

  if (name === "" || name.length > TEXT_MAX) return null;
  if (country === "" || country.length > TEXT_MAX) return null;
  if (typeof latitude !== "number" || !(Math.abs(latitude) <= 90)) return null;
  if (typeof longitude !== "number" || !(Math.abs(longitude) <= 180)) {
    return null;
  }
  return { name, country, latitude, longitude };
}
