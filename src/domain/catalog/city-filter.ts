/**
 * A filter by city on a list of the person's places: History and Saved (#187). The chosen city lives in
 * the address (`?city=city-paris`); one that is unknown, or has none of the places, is all cities.
 */

/** A city and how many of the listed places are in it. */
export interface CityCount {
  id: string;
  name: string;
  count: number;
}

type Param = string | string[] | undefined | null;

/** The cities with places, by name: the buttons of the filter. */
export function citiesWithPlaces(cities: readonly CityCount[]): CityCount[] {
  return cities
    .filter((city) => city.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The chosen city of the address, or null for all cities. */
export function chosenCityId(
  param: Param,
  cities: readonly CityCount[]
): string | null {
  const id = Array.isArray(param) ? param[0] : param;
  return citiesWithPlaces(cities).find((city) => city.id === id)?.id ?? null;
}

/**
 * The city a filter without "All cities" opens on: the preferred one when it has places, else the first
 * city with places by name, or null when there are none.
 */
export function defaultCityId(
  cities: readonly CityCount[],
  preferredId: string
): string | null {
  const withPlaces = citiesWithPlaces(cities);
  return (
    withPlaces.find((city) => city.id === preferredId)?.id ??
    withPlaces[0]?.id ??
    null
  );
}
