/**
 * History, the record of the places a person visited (US-C3-01; the city filter and the pages, #187).
 *
 * The city and the page live in the address (`/visited?city=city-paris&page=2`), so Back, refresh and
 * a shared link keep them. What cannot be read never breaks the page: an unknown city, or one with none
 * of the person's places, is all cities; a page that is too big, too small or not a number is the
 * nearest real page.
 */

import {
  chosenCityId,
  citiesWithPlaces,
  type CityCount,
} from "@/domain/catalog/city-filter";

export type { CityCount };

/** 24 fills whole rows of 2, 3 and 4 cards. */
export const HISTORY_PAGE_SIZE = 24;

export interface HistoryView {
  /** The chosen city, null for all cities. */
  cityId: string | null;
  page: number;
  totalPages: number;
  /** The places in the chosen city, or in all of them. */
  total: number;
  skip: number;
  take: number;
  /** "Showing 25 to 48 of 68": 0 and 0 when there is nothing to show. */
  firstShown: number;
  lastShown: number;
}

type Param = string | string[] | undefined;

function first(value: Param): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The cities with places of the person, by name: the buttons of the filter. */
export const citiesWithVisits = citiesWithPlaces;

/**
 * The city and the page to show, from the parameters of the address.
 *
 * @param params the `city` and `page` of the address, as Next.js gives them
 * @param cities how many of the person's places are in each city
 */
export function historyView(
  params: { city?: Param; page?: Param },
  cities: readonly CityCount[]
): HistoryView {
  const withVisits = citiesWithPlaces(cities);
  const cityId = chosenCityId(params.city, cities);
  const city = withVisits.find((c) => c.id === cityId) ?? null;
  const total = city
    ? city.count
    : withVisits.reduce((sum, c) => sum + c.count, 0);
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  const raw = first(params.page);
  const asked = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : 1;
  const page = Math.min(Math.max(asked, 1), totalPages);
  const skip = (page - 1) * HISTORY_PAGE_SIZE;

  return {
    cityId: city?.id ?? null,
    page,
    totalPages,
    total,
    skip,
    take: HISTORY_PAGE_SIZE,
    firstShown: total === 0 ? 0 : skip + 1,
    lastShown: Math.min(skip + HISTORY_PAGE_SIZE, total),
  };
}

/** The address of a city and a page; the defaults (all cities, page 1) are left out. */
export function historyHref(cityId: string | null, page = 1): string {
  const params = new URLSearchParams();
  if (cityId) params.set("city", cityId);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/visited?${query}` : "/visited";
}
