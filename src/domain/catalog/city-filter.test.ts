import { describe, it, expect } from "vitest";
import {
  chosenCityId,
  citiesWithPlaces,
  defaultCityId,
  type CityCount,
} from "./city-filter";

const CITIES: CityCount[] = [
  { id: "city-porto", name: "Porto", count: 84 },
  { id: "city-paris", name: "Paris", count: 68 },
  { id: "city-berlim", name: "Berlin", count: 65 },
  { id: "city-lisboa", name: "Lisboa", count: 0 },
];

describe("citiesWithPlaces: the buttons of a filter by city (#187)", () => {
  it("keeps only the cities with places, by name", () => {
    expect(citiesWithPlaces(CITIES).map((c) => c.name)).toEqual([
      "Berlin",
      "Paris",
      "Porto",
    ]);
  });
});

describe("chosenCityId: the city of the address (#187)", () => {
  it("is the city when it has places", () => {
    expect(chosenCityId("city-paris", CITIES)).toBe("city-paris");
  });

  it("is null, all cities, for no city, an unknown one or one without places", () => {
    for (const city of [undefined, "", "city-nowhere", "city-lisboa"]) {
      expect(chosenCityId(city, CITIES)).toBeNull();
    }
  });

  it("reads the first value when the city is given twice", () => {
    expect(chosenCityId(["city-porto", "city-paris"], CITIES)).toBe(
      "city-porto"
    );
  });
});

describe("defaultCityId: the city a filter without All cities opens on (#187)", () => {
  it("is Porto when it has places", () => {
    expect(defaultCityId(CITIES, "city-porto")).toBe("city-porto");
  });

  it("is the first city by name when the preferred one has no places", () => {
    expect(defaultCityId(CITIES, "city-lisboa")).toBe("city-berlim");
    expect(defaultCityId(CITIES, "city-nowhere")).toBe("city-berlim");
  });

  it("is null when no city has places", () => {
    expect(defaultCityId([], "city-porto")).toBeNull();
  });
});
