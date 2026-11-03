import { describe, it, expect } from "vitest";
import { PlaceCategory } from "@prisma/client";
import {
  parseNominatimResult,
  isNominatimResponse,
  placeFromNominatim,
  formatOsmId,
  discoveredPlaceId,
  osmIdFromDiscoveredPlaceId,
} from "./osm";

describe("Nominatim Result Parsing", () => {
  it("validates valid Nominatim array response with pure type guard", () => {
    const valid = [
      {
        place_id: 100,
        osm_type: "node",
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
      osm_type: "node",
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
    expect(parsed?.osmId).toBe("node/200");
    expect(parsed?.name).toBe("Torre dos Clérigos");
    expect(parsed?.category).toBe(PlaceCategory.MONUMENT);
    expect(parsed?.latitude).toBe(41.1458);
    expect(parsed?.longitude).toBe(-8.6142);
  });

  it("extracts short clean name from display_name when address name is absent", () => {
    const raw = {
      place_id: 101,
      osm_type: "way",
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

  it("returns null for an item without an OpenStreetMap type: the id would be ambiguous", () => {
    const raw = {
      place_id: 103,
      osm_id: 203,
      lat: "41.1458",
      lon: "-8.6142",
      display_name: "Somewhere, Porto",
    };

    expect(parseNominatimResult(raw)).toBeNull();
  });

  it("gives a place found by the search the same id as the import gives it, so it is the same place", () => {
    const item = {
      place_id: 104,
      osm_type: "way",
      osm_id: 4242,
      lat: "48.8606",
      lon: "2.3376",
      name: "Musée du Louvre",
      display_name: "Musée du Louvre, Paris, France",
      class: "tourism",
      type: "museum",
    };
    const area = {
      name: "Paris",
      minLat: 48.8,
      maxLat: 48.92,
      minLon: 2.22,
      maxLon: 2.47,
    };

    expect(parseNominatimResult(item)?.osmId).toBe("way/4242");
    expect(placeFromNominatim(item, area)?.osmId).toBe("way/4242");
  });
});

describe("OpenStreetMap ids", () => {
  it("is the type and the number, because a node and a way can have the same number", () => {
    expect(formatOsmId("node", 4242)).toBe("node/4242");
    expect(formatOsmId("way", 4242)).toBe("way/4242");
    expect(formatOsmId("relation", "4242")).toBe("relation/4242");
    expect(formatOsmId("node", 4242)).not.toBe(formatOsmId("way", 4242));
  });

  it("is null when the type or the number is missing or wrong", () => {
    expect(formatOsmId(undefined, 4242)).toBeNull();
    expect(formatOsmId(null, 4242)).toBeNull();
    expect(formatOsmId("area", 4242)).toBeNull();
    expect(formatOsmId("way", undefined)).toBeNull();
    expect(formatOsmId("way", "")).toBeNull();
    expect(formatOsmId("way", "42a")).toBeNull();
    expect(formatOsmId("way", -5)).toBeNull();
    expect(formatOsmId("way", 4.5)).toBeNull();
  });

  it("makes the id of a discovered place without a slash, and gets the OpenStreetMap id back from it", () => {
    expect(discoveredPlaceId("way/4242")).toBe("osm-way-4242");
    expect(discoveredPlaceId("way/4242")).not.toContain("/");
    for (const osmId of ["node/1", "way/4242", "relation/987654321"]) {
      expect(osmIdFromDiscoveredPlaceId(discoveredPlaceId(osmId))).toBe(osmId);
    }
  });

  it("gives no OpenStreetMap id for an id that is not one of a discovered place", () => {
    expect(osmIdFromDiscoveredPlaceId("osm-4242")).toBeNull();
    expect(osmIdFromDiscoveredPlaceId("osm-way-")).toBeNull();
    expect(osmIdFromDiscoveredPlaceId("osm-area-4242")).toBeNull();
    expect(osmIdFromDiscoveredPlaceId("4242")).toBeNull();
    expect(
      osmIdFromDiscoveredPlaceId("5e1f6a3c-0d3e-4a52-9c1e-3f7d2b1a9c10")
    ).toBeNull();
  });
});
