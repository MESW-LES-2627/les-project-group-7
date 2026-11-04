/**
 * The place search rule: a place matches when its name or address contains the query, ignoring
 * case and accents, and reading ß as ss. Pure functions, so the rule can be tested without the UI.
 */

// TODO after PR #124 is merged:
// - Duplicate code: city-search.ts has its own normalizeSearchText, without the ß rule. Keep one
//   shared function, so the city search also reads ß as ss.
// - Possible conflicts with PR #123: usePlaceFiltering.ts conflicts with this branch and
//   PlaceExplorer.tsx conflicts with PR #124. Whichever merges later has to resolve them, and
//   the place search must keep using placeMatchesSearch.
function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .trim();
}

/** Whether the name or the address contains the query. An empty query matches every place. */
export function placeMatchesSearch(
  place: { name: string; address: string },
  query: string
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  return (
    normalizeSearchText(place.name).includes(normalizedQuery) ||
    normalizeSearchText(place.address).includes(normalizedQuery)
  );
}
