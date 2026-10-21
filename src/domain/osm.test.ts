import { describe, it, expect } from "vitest";
import { PlaceCategory } from "@prisma/client";
import {
  mapOsmCategory,
  mapOsmPriceLevel,
  formatOsmAddress,
  getQuantizedKey,
} from "./osm";

describe("OSM Domain Mapping", () => {
  describe("mapOsmCategory", () => {
    it("maps tourism=museum to MUSEUM", () => {
      expect(mapOsmCategory({ tourism: "museum" })).toBe(PlaceCategory.MUSEUM);
    });

    it("maps amenity=restaurant to RESTAURANT", () => {
      expect(mapOsmCategory({ amenity: "restaurant" })).toBe(PlaceCategory.RESTAURANT);
    });

    it("maps amenity=cafe to CAFE", () => {
      expect(mapOsmCategory({ amenity: "cafe" })).toBe(PlaceCategory.CAFE);
    });

    it("maps amenity=bar and amenity=pub to BAR", () => {
      expect(mapOsmCategory({ amenity: "bar" })).toBe(PlaceCategory.BAR);
      expect(mapOsmCategory({ amenity: "pub" })).toBe(PlaceCategory.BAR);
    });

    it("maps leisure=park and leisure=garden to PARK", () => {
      expect(mapOsmCategory({ leisure: "park" })).toBe(PlaceCategory.PARK);
      expect(mapOsmCategory({ leisure: "garden" })).toBe(PlaceCategory.PARK);
    });

    it("maps historic monuments and tourist viewpoints to MONUMENT", () => {
      expect(mapOsmCategory({ historic: "monument" })).toBe(PlaceCategory.MONUMENT);
      expect(mapOsmCategory({ historic: "memorial" })).toBe(PlaceCategory.MONUMENT);
      expect(mapOsmCategory({ tourism: "attraction" })).toBe(PlaceCategory.MONUMENT);
      expect(mapOsmCategory({ tourism: "viewpoint" })).toBe(PlaceCategory.MONUMENT);
    });

    it("falls back defensively to OTHER for null, undefined, or unrecognized tags", () => {
      expect(mapOsmCategory(null)).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory(undefined)).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory({})).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory({ amenity: "parking" })).toBe(PlaceCategory.OTHER);
    });
  });

  describe("mapOsmPriceLevel", () => {
    it("maps fee=no and fee=0 to FREE", () => {
      expect(mapOsmPriceLevel({ fee: "no" })).toBe("FREE");
      expect(mapOsmPriceLevel({ fee: "0" })).toBe("FREE");
    });

    it("defaults to standard € price tier", () => {
      expect(mapOsmPriceLevel(null)).toBe("€");
      expect(mapOsmPriceLevel({})).toBe("€");
      expect(mapOsmPriceLevel({ fee: "yes" })).toBe("€");
    });
  });

  describe("formatOsmAddress", () => {
    it("combines street and housenumber into clean address string", () => {
      const address = formatOsmAddress({
        "addr:street": "Rua dos Clérigos",
        "addr:housenumber": "42",
      });
      expect(address).toBe("Rua dos Clérigos 42");
    });

    it("returns default city name when street info is missing", () => {
      expect(formatOsmAddress(null, "Porto")).toBe("Porto");
      expect(formatOsmAddress({}, "Porto")).toBe("Porto");
    });
  });

  describe("getQuantizedKey", () => {
    it("quantizes bounding-box coordinates to 3 decimal places (~100m grid)", () => {
      const key = getQuantizedKey(41.14567, -8.61432, 41.15123, -8.60891);
      expect(key).toBe("41.146:-8.614:41.151:-8.609");
    });

    it("ensures subtle coordinate adjustments in the same grid share the cache key", () => {
      const key1 = getQuantizedKey(41.14561, -8.61431, 41.15121, -8.60891);
      const key2 = getQuantizedKey(41.14564, -8.61433, 41.15123, -8.60894);
      expect(key1).toBe(key2);
    });
  });
});
