import { describe, it, expect } from "vitest";
import { placeLocation } from "./place-location";

describe("placeLocation: the address with the city once (#187)", () => {
  it("does not repeat the city when the address already ends with it", () => {
    expect(placeLocation("Rue de Rivoli, 75001, Paris", "Paris")).toBe(
      "Rue de Rivoli, 75001, Paris"
    );
    expect(placeLocation("Kopernikusstraße, 10245, Berlin", "Berlin")).toBe(
      "Kopernikusstraße, 10245, Berlin"
    );
  });

  it("does not repeat it after a postcode in the same part, or in other letters case", () => {
    expect(placeLocation("Rua das Flores 12, 4050-262 Porto", "Porto")).toBe(
      "Rua das Flores 12, 4050-262 Porto"
    );
    expect(placeLocation("Quai X, 75005, PARIS", "Paris")).toBe(
      "Quai X, 75005, PARIS"
    );
  });

  it("adds the city when the address does not have it", () => {
    expect(placeLocation("92200, Neuilly-sur-Seine", "Paris")).toBe(
      "92200, Neuilly-sur-Seine, Paris"
    );
    expect(placeLocation("Rua de Santa Catarina", "Porto")).toBe(
      "Rua de Santa Catarina, Porto"
    );
  });

  it("is not fooled by a city name inside another word", () => {
    expect(placeLocation("Rue de Parisot", "Paris")).toBe(
      "Rue de Parisot, Paris"
    );
  });

  it("adds the country at the end when it is given", () => {
    expect(
      placeLocation("Zwieseler Straße, 10318, Berlin", "Berlin", "Germany")
    ).toBe("Zwieseler Straße, 10318, Berlin, Germany");
  });

  it("works without an address or without a city", () => {
    expect(placeLocation("", "Porto", "Portugal")).toBe("Porto, Portugal");
    expect(placeLocation(null, "Porto")).toBe("Porto");
    expect(placeLocation("Rua X", null)).toBe("Rua X");
    expect(placeLocation("   ", undefined)).toBe("");
  });
});
