import { describe, it, expect } from "vitest";
import { PlaceCategory } from "@prisma/client";
import {
  filterPlaces,
  sortPlacesByRating,
  NO_PLACE_FILTERS,
  type PlaceFilters,
} from "./filters";

const places = [
  {
    id: "cheap",
    name: "cheap",
    category: PlaceCategory.RESTAURANT,
    priceLevel: "€",
    averageRating: 4.5,
  },
  {
    id: "dear",
    name: "dear",
    category: PlaceCategory.RESTAURANT,
    priceLevel: "€€€",
    averageRating: 3.9,
  },
  {
    id: "museum",
    name: "museum",
    category: PlaceCategory.MUSEUM,
    priceLevel: "€",
    averageRating: 4,
  },
  {
    id: "new",
    name: "new",
    category: PlaceCategory.MUSEUM,
    priceLevel: null,
    averageRating: null,
  },
];

function ids(filters: Partial<PlaceFilters>) {
  return filterPlaces(places, { ...NO_PLACE_FILTERS, ...filters }).map(
    (place) => place.id
  );
}

describe("filterPlaces", () => {
  it("lists every place when no filter is set", () => {
    expect(ids({})).toEqual(["cheap", "dear", "museum", "new"]);
  });

  it("lists only the places of the chosen type", () => {
    expect(ids({ category: PlaceCategory.RESTAURANT })).toEqual([
      "cheap",
      "dear",
    ]);
  });

  it("lists only the places of the chosen price level, never one without a level", () => {
    expect(ids({ priceLevel: "€" })).toEqual(["cheap", "museum"]);
  });

  it("includes the minimum rating itself and leaves out places without reviews", () => {
    expect(ids({ minRating: 4 })).toEqual(["cheap", "museum"]);
  });

  it("lists places without a price level when no price filter is set", () => {
    expect(ids({ category: PlaceCategory.MUSEUM })).toEqual(["museum", "new"]);
  });

  it("applies all filters together", () => {
    expect(
      ids({ category: PlaceCategory.RESTAURANT, priceLevel: "€", minRating: 4 })
    ).toEqual(["cheap"]);
    expect(ids({ category: PlaceCategory.MUSEUM, priceLevel: "€€€" })).toEqual(
      []
    );
  });
});

describe("sortPlacesByRating", () => {
  it("puts the best rated first and places without reviews last", () => {
    expect(sortPlacesByRating(places).map((place) => place.id)).toEqual([
      "cheap",
      "museum",
      "dear",
      "new",
    ]);
  });

  it("breaks a tie by the number of reviews, without changing the input", () => {
    const tied = [
      { id: "few", name: "A", averageRating: 4, reviewCount: 2 },
      { id: "many", name: "B", averageRating: 4, reviewCount: 9 },
    ];
    expect(sortPlacesByRating(tied).map((place) => place.id)).toEqual([
      "many",
      "few",
    ]);
    expect(tied[0].id).toBe("few");
  });

  it("breaks a full tie by name", () => {
    const tied = [
      { id: "z", name: "Zoo", averageRating: 4, reviewCount: 3 },
      { id: "a", name: "Arco", averageRating: 4, reviewCount: 3 },
    ];
    expect(sortPlacesByRating(tied).map((place) => place.id)).toEqual([
      "a",
      "z",
    ]);
  });
});
