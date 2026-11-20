import { describe, it, expect } from "vitest";
import { areaOfCity, CITY_AREAS } from "./city-areas";
import { isInsideArea } from "./osm";

describe("areaOfCity", () => {
  it("gives the area of each city of the MVP", () => {
    expect(areaOfCity("city-porto")?.name).toBe("Porto");
    expect(areaOfCity("city-paris")?.name).toBe("Paris");
    expect(areaOfCity("city-berlim")?.name).toBe("Berlin");
  });

  it("gives null for a city that has none, and for names of the object itself", () => {
    expect(areaOfCity("city-nowhere")).toBeNull();
    expect(areaOfCity("")).toBeNull();
    expect(areaOfCity("toString")).toBeNull();
    expect(areaOfCity("__proto__")).toBeNull();
  });

  it("has the centre of each city inside its own area and not inside another's", () => {
    const centres = {
      "city-porto": [41.1579, -8.6291],
      "city-paris": [48.8566, 2.3522],
      "city-berlim": [52.52, 13.405],
    } as const;

    for (const [id, [lat, lon]] of Object.entries(centres)) {
      for (const [other, area] of Object.entries(CITY_AREAS)) {
        expect(isInsideArea(area, lat, lon)).toBe(other === id);
      }
    }
  });
});
