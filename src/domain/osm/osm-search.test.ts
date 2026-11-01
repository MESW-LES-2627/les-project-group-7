import { describe, it, expect } from "vitest";
import { PlaceCategory } from "@prisma/client";
import { parseNominatimResult, isNominatimResponse } from "./osm";

describe("Nominatim Result Parsing", () => {
  it("validates valid Nominatim array response with pure type guard", () => {
    const valid = [
      {
        place_id: 100,
        osm_id: 200,
        lat: "41.145",
        lon: "-8.614",
        display_name: "Torre dos Clérigos, Porto, Portugal",
        class: "tourism",
        type: "attraction",
      },
    ];

    expect(isNominatimResponse(valid)).toBe(true);
    expect(isNominatimResponse({})).toBe(false);
    expect(isNominatimResponse(null)).toBe(false);
    expect(isNominatimResponse("error")).toBe(false);
  });

  it("parses valid Nominatim item into canonical OsmSearchResult", () => {
    const raw = {
      place_id: 100,
      osm_id: 200,
      lat: "41.1458",
      lon: "-8.6142",
      display_name: "Torre dos Clérigos, Rua dos Clérigos, Porto, Portugal",
      class: "historic",
      type: "monument",
      address: {
        road: "Rua dos Clérigos",
        city: "Porto",
      },
    };

    const parsed = parseNominatimResult(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.osmId).toBe("200");
    expect(parsed?.name).toBe("Torre dos Clérigos");
    expect(parsed?.category).toBe(PlaceCategory.MONUMENT);
    expect(parsed?.latitude).toBe(41.1458);
    expect(parsed?.longitude).toBe(-8.6142);
  });

  it("extracts short clean name from display_name when address name is absent", () => {
    const raw = {
      place_id: 101,
      osm_id: 201,
      lat: "48.8584",
      lon: "2.2945",
      display_name: "Tour Eiffel, Champ de Mars, Paris, France",
      class: "tourism",
      type: "attraction",
    };

    const parsed = parseNominatimResult(raw);
    expect(parsed?.name).toBe("Tour Eiffel");
    expect(parsed?.category).toBe(PlaceCategory.MONUMENT);
  });

  it("returns null for malformed items lacking latitude or longitude", () => {
    const invalid = {
      osm_id: 202,
      display_name: "Invalid coordinates",
    };

    expect(parseNominatimResult(invalid)).toBeNull();
  });

  it("keeps the bounding box so the map can show a whole city or country", () => {
    const parsed = parseNominatimResult({
      place_id: 1,
      osm_id: 2,
      lat: "40.4",
      lon: "-3.7",
      display_name: "Madrid, Spain",
      boundingbox: ["40.31", "40.64", "-3.89", "-3.52"],
    });

    expect(parsed?.boundingBox).toEqual({
      south: 40.31,
      north: 40.64,
      west: -3.89,
      east: -3.52,
    });
    expect(
      parseNominatimResult({
        place_id: 1,
        osm_id: 2,
        lat: "40.4",
        lon: "-3.7",
        display_name: "Madrid, Spain",
      })?.boundingBox
    ).toBeUndefined();
  });

  it("marks a city or town result, with its country, so it can be added to the catalog", () => {
    const base = { place_id: 1, osm_id: 2, lat: "40.4", lon: "-3.7" };
    const city = parseNominatimResult({
      ...base,
      display_name: "Madrid, España",
      addresstype: "city",
      address: { country: "España" },
    });
    expect(city).toMatchObject({ isCity: true, country: "España" });

    const shop = parseNominatimResult({
      ...base,
      display_name: "Livraria Lello, Porto",
      addresstype: "shop",
      address: { country: "Portugal" },
    });
    expect(shop?.isCity).toBeUndefined();
  });
});
