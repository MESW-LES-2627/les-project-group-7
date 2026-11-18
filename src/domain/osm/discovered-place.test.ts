import { describe, it, expect } from "vitest";
import { CITY_AREAS } from "./city-areas";
import {
  parseDiscoveredPlace,
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
} from "./discovered-place";

const PORTO = CITY_AREAS["city-porto"];

const place = (extra: Record<string, unknown> = {}) => ({
  name: "Livraria Lello",
  latitude: 41.1469,
  longitude: -8.6148,
  address: "Rua das Carmelitas, Porto",
  category: "MONUMENT",
  priceLevel: "€",
  ...extra,
});

function failure(result: ReturnType<typeof parseDiscoveredPlace>) {
  if (result.ok) throw new Error("expected a refusal");
  return result;
}

describe("parseDiscoveredPlace: a good place", () => {
  it("is saved with the id of the map and its OpenStreetMap id", () => {
    const result = parseDiscoveredPlace("osm-node-4242", place(), PORTO);

    expect(result).toEqual({
      ok: true,
      value: {
        id: "osm-node-4242",
        osmId: "node/4242",
        name: "Livraria Lello",
        address: "Rua das Carmelitas, Porto",
        category: "MONUMENT",
        latitude: 41.1469,
        longitude: -8.6148,
        priceLevel: "€",
      },
    });
  });

  it("accepts ways and relations too", () => {
    for (const [id, osmId] of [
      ["osm-way-77", "way/77"],
      ["osm-relation-9", "relation/9"],
    ]) {
      const result = parseDiscoveredPlace(id, place(), PORTO);

      expect(result.ok && result.value.osmId).toBe(osmId);
    }
  });

  it("trims the name and the address", () => {
    const result = parseDiscoveredPlace(
      "osm-node-1",
      place({ name: "  Café  ", address: "  Rua X  " }),
      PORTO
    );

    expect(result.ok && [result.value.name, result.value.address]).toEqual([
      "Café",
      "Rua X",
    ]);
  });

  it("has the city as its address, no price and the category OTHER when they are missing or wrong", () => {
    const result = parseDiscoveredPlace(
      "osm-node-1",
      place({ address: "  ", category: "SPACESHIP", priceLevel: "$$$$" }),
      PORTO
    );

    expect(result.ok && result.value).toMatchObject({
      address: "Porto",
      category: "OTHER",
      priceLevel: null,
    });
  });

  it("cuts an address that is too long instead of refusing the place", () => {
    const result = parseDiscoveredPlace(
      "osm-node-1",
      place({ address: "x".repeat(1000) }),
      PORTO
    );

    expect(result.ok && result.value.address).toHaveLength(
      PLACE_ADDRESS_MAX_LENGTH
    );
  });

  it("accepts a place on the border of the area", () => {
    const result = parseDiscoveredPlace(
      "osm-node-1",
      place({ latitude: PORTO.minLat, longitude: PORTO.maxLon }),
      PORTO
    );

    expect(result.ok).toBe(true);
  });
});

describe("parseDiscoveredPlace: outside the city is refused (AC6)", () => {
  it("refuses a place in another city", () => {
    // Lisbon is in Portugal but not in the area of Porto
    const result = failure(
      parseDiscoveredPlace(
        "osm-node-1",
        place({ latitude: 38.7223, longitude: -9.1393 }),
        PORTO
      )
    );

    expect(result.reason).toBe("OTHER_CITY");
    expect(result.error).toContain("outside Porto");
  });

  it("refuses a place just outside each border", () => {
    const outside = [
      { latitude: PORTO.minLat - 0.001 },
      { latitude: PORTO.maxLat + 0.001 },
      { longitude: PORTO.minLon - 0.001 },
      { longitude: PORTO.maxLon + 0.001 },
    ];

    for (const position of outside) {
      const result = failure(
        parseDiscoveredPlace("osm-node-1", place(position), PORTO)
      );

      expect(result.reason).toBe("OTHER_CITY");
    }
  });

  it("checks the area of the city of the trip: a place of Porto is outside Paris", () => {
    const result = failure(
      parseDiscoveredPlace("osm-node-1", place(), CITY_AREAS["city-paris"])
    );

    expect(result.reason).toBe("OTHER_CITY");
  });

  it("refuses every place when the city has no area", () => {
    const result = failure(parseDiscoveredPlace("osm-node-1", place(), null));

    expect(result.reason).toBe("OTHER_CITY");
  });
});

describe("parseDiscoveredPlace: wrong or missing data", () => {
  it("has nothing to save a place from when the id is not an OpenStreetMap id", () => {
    for (const id of ["abc", "osm-1", "osm-node-x", "osm-note-1", ""]) {
      const result = failure(parseDiscoveredPlace(id, place(), PORTO));

      expect(result.reason).toBe("NO_DATA");
    }
  });

  it("has nothing to save a place from when no data is sent", () => {
    for (const raw of [undefined, null, "text", 5, []]) {
      const result = failure(parseDiscoveredPlace("osm-node-1", raw, PORTO));

      expect(result.reason).toBe("NO_DATA");
    }
  });

  it("refuses a missing, empty or too long name", () => {
    for (const name of [
      undefined,
      "",
      "   ",
      5,
      "x".repeat(PLACE_NAME_MAX_LENGTH + 1),
    ]) {
      const result = failure(
        parseDiscoveredPlace("osm-node-1", place({ name }), PORTO)
      );

      expect(result.reason).toBe("INVALID");
    }
  });

  it("refuses a position that is not a real position", () => {
    const wrong = [
      { latitude: undefined },
      { latitude: "41.1" },
      { latitude: Number.NaN },
      { latitude: Number.POSITIVE_INFINITY },
      { latitude: 91 },
      { longitude: null },
      { longitude: -181 },
    ];

    for (const position of wrong) {
      const result = failure(
        parseDiscoveredPlace("osm-node-1", place(position), PORTO)
      );

      expect(result.reason).toBe("INVALID");
    }
  });
});
