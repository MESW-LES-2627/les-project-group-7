import { describe, it, expect } from "vitest";
import { placeMatchesSearch } from "./place-search";

const place = {
  name: "Café Majestic",
  address: "Rua de Santa Catarina 112, Porto",
};

describe("placeMatchesSearch", () => {
  it("finds a place by part of its name", () => {
    expect(placeMatchesSearch(place, "majes")).toBe(true);
  });

  it("finds a place by part of its address", () => {
    expect(placeMatchesSearch(place, "santa catarina")).toBe(true);
  });

  it("ignores case", () => {
    expect(placeMatchesSearch(place, "MAJESTIC")).toBe(true);
  });

  it("ignores accents in the place and in the query", () => {
    expect(placeMatchesSearch(place, "cafe")).toBe(true);
    expect(placeMatchesSearch(place, "pôrto")).toBe(true);
  });

  it("reads ß as ss, in the place and in the query", () => {
    const berlin = { name: "Museum", address: "Friedrichstraße 43, Berlin" };
    expect(placeMatchesSearch(berlin, "friedrichstrasse")).toBe(true);
    expect(placeMatchesSearch(berlin, "FRIEDRICHSTRASSE")).toBe(true);
    expect(placeMatchesSearch(berlin, "friedrichstraße")).toBe(true);
    expect(
      placeMatchesSearch(
        { name: "Museum", address: "Friedrichstrasse 43" },
        "straße"
      )
    ).toBe(true);
  });

  it("ignores spaces around the query", () => {
    expect(placeMatchesSearch(place, "  cafe ")).toBe(true);
  });

  it("matches every place when the query is empty", () => {
    expect(placeMatchesSearch(place, "   ")).toBe(true);
  });

  it("does not match when neither the name nor the address contains the query", () => {
    expect(placeMatchesSearch(place, "museum")).toBe(false);
  });
});
