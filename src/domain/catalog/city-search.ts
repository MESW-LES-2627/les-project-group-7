/**
 * The city search on the home page. Pure function, so the rule (ignore case and accents)
 * can be tested without the UI.
 */

import { normalizeSearchText } from "./search-text";

/** The cities whose name contains the query, in the given order. An empty query matches all. */
export function filterCitiesByName<City extends { name: string }>(
  cities: readonly City[],
  query: string
): City[] {
  const normalizedQuery = normalizeSearchText(query);
  return cities.filter((city) =>
    normalizeSearchText(city.name).includes(normalizedQuery)
  );
}
