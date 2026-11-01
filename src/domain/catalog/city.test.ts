import { describe, expect, it } from "vitest";
import { cityBounds, parseNewCity } from "./city";

describe("parseNewCity", () => {
  const valid = {
    name: " Madrid ",
    country: "España",
    latitude: 40.4,
    longitude: -3.7,
  };

  it("accepts a complete city and trims the text", () => {
    expect(parseNewCity(valid)).toEqual({ ...valid, name: "Madrid" });
  });

  it("rejects missing or empty text", () => {
    expect(parseNewCity({ ...valid, name: "  " })).toBeNull();
    expect(parseNewCity({ ...valid, country: undefined })).toBeNull();
  });

  it("rejects coordinates that are out of range or not numbers", () => {
    expect(parseNewCity({ ...valid, latitude: 91 })).toBeNull();
    expect(parseNewCity({ ...valid, longitude: -181 })).toBeNull();
    expect(parseNewCity({ ...valid, latitude: "40.4" })).toBeNull();
    expect(parseNewCity({ ...valid, longitude: NaN })).toBeNull();
  });

  it("rejects a body that is not an object", () => {
    expect(parseNewCity(null)).toBeNull();
    expect(parseNewCity([valid])).toBeNull();
  });
});

describe("cityBounds", () => {
  it("surrounds the centre of the city", () => {
    const box = cityBounds(41.15, -8.61);
    expect(box.south).toBeLessThan(41.15);
    expect(box.north).toBeGreaterThan(41.15);
    expect(box.west).toBeLessThan(-8.61);
    expect(box.east).toBeGreaterThan(-8.61);
  });
});
