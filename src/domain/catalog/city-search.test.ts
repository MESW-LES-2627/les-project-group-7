import { describe, it, expect } from "vitest";
import { filterCitiesByName } from "./city-search";

const cities = [{ name: "Lisbon" }, { name: "Porto" }, { name: "São Paulo" }];

function names(query: string) {
  return filterCitiesByName(cities, query).map((city) => city.name);
}

describe("filterCitiesByName", () => {
  it("finds a city by part of its name", () => {
    expect(names("ort")).toEqual(["Porto"]);
  });

  it("ignores case", () => {
    expect(names("LISB")).toEqual(["Lisbon"]);
  });

  it("ignores accents in the name and in the query", () => {
    expect(names("sao")).toEqual(["São Paulo"]);
    expect(names("pôrto")).toEqual(["Porto"]);
  });

  it("reads ß as ss", () => {
    const german = [{ name: "Weißenfels" }];
    expect(filterCitiesByName(german, "weissen")).toEqual(german);
  });

  it("ignores spaces around the query", () => {
    expect(names("  porto ")).toEqual(["Porto"]);
  });

  it("lists every city when the query is empty", () => {
    expect(names("  ")).toEqual(["Lisbon", "Porto", "São Paulo"]);
  });

  it("lists nothing when no name matches", () => {
    expect(names("Madrid")).toEqual([]);
  });
});
