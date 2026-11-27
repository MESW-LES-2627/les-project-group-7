import { describe, it, expect } from "vitest";
import {
  HISTORY_PAGE_SIZE,
  citiesWithVisits,
  historyHref,
  historyView,
  type CityCount,
} from "./history";

const CITIES: CityCount[] = [
  { id: "city-porto", name: "Porto", count: 84 },
  { id: "city-paris", name: "Paris", count: 68 },
  { id: "city-berlim", name: "Berlin", count: 65 },
  { id: "city-lisboa", name: "Lisboa", count: 0 },
];

describe("citiesWithVisits: the city buttons of History (#187)", () => {
  it("keeps only the cities with places of the person, by name", () => {
    expect(citiesWithVisits(CITIES).map((c) => c.name)).toEqual([
      "Berlin",
      "Paris",
      "Porto",
    ]);
  });
});

describe("historyView: the city and the page from the address (#187)", () => {
  it("shows all cities, first page, when the address has neither", () => {
    expect(historyView({}, CITIES)).toEqual({
      cityId: null,
      page: 1,
      totalPages: Math.ceil(217 / HISTORY_PAGE_SIZE),
      total: 217,
      skip: 0,
      take: HISTORY_PAGE_SIZE,
      firstShown: 1,
      lastShown: HISTORY_PAGE_SIZE,
    });
  });

  it("uses 24 per page, which fills whole rows of 2, 3 and 4 cards", () => {
    expect(HISTORY_PAGE_SIZE).toBe(24);
  });

  it("counts only the places of the chosen city", () => {
    const view = historyView({ city: "city-paris", page: "3" }, CITIES);

    expect(view).toMatchObject({
      cityId: "city-paris",
      page: 3,
      totalPages: 3,
      total: 68,
      skip: 48,
      firstShown: 49,
      lastShown: 68,
    });
  });

  it("falls back to all cities for a city that does not exist or has none of the person's places", () => {
    for (const city of ["city-nowhere", "city-lisboa", ""]) {
      expect(historyView({ city }, CITIES).cityId).toBeNull();
    }
  });

  it("goes to the nearest real page for a page that is too big, too small or not a number", () => {
    const last = Math.ceil(217 / HISTORY_PAGE_SIZE);

    expect(historyView({ page: "99" }, CITIES).page).toBe(last);
    for (const page of ["0", "-2", "abc", "1.5", "2e1", ""]) {
      expect(historyView({ page }, CITIES).page).toBe(1);
    }
  });

  it("reads the first value when a parameter is given twice", () => {
    expect(
      historyView(
        { city: ["city-porto", "city-paris"], page: ["2", "3"] },
        CITIES
      )
    ).toMatchObject({ cityId: "city-porto", page: 2 });
  });

  it("has one empty page for a person with no places", () => {
    expect(historyView({ page: "4" }, [])).toEqual({
      cityId: null,
      page: 1,
      totalPages: 1,
      total: 0,
      skip: 0,
      take: HISTORY_PAGE_SIZE,
      firstShown: 0,
      lastShown: 0,
    });
  });

  it("ends the last page at the last place", () => {
    const view = historyView({ page: "10" }, CITIES);

    expect([view.firstShown, view.lastShown]).toEqual([217, 217]);
  });
});

describe("historyHref: the address of a city and a page (#187)", () => {
  it("leaves out what is the default, so the plain address is all cities, page 1", () => {
    expect(historyHref(null)).toBe("/visited");
    expect(historyHref(null, 1)).toBe("/visited");
    expect(historyHref("city-porto")).toBe("/visited?city=city-porto");
  });

  it("keeps the city when it changes page", () => {
    expect(historyHref("city-porto", 2)).toBe(
      "/visited?city=city-porto&page=2"
    );
    expect(historyHref(null, 3)).toBe("/visited?page=3");
  });

  it("encodes an id that has characters of an address", () => {
    expect(historyHref("a b&c", 2)).toBe("/visited?city=a+b%26c&page=2");
  });
});
