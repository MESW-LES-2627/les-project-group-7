import { describe, it, expect } from "vitest";
import { PlaceCategory } from "@prisma/client";
import {
  mapOsmCategory,
  mapOsmPriceLevel,
  openingHoursFromTags,
  formatOsmAddress,
  formatNominatimAddress,
  placeFromNominatim,
  getQuantizedKey,
  type CityArea,
} from "./osm";

describe("OSM Domain Mapping", () => {
  describe("mapOsmCategory", () => {
    it("maps tourism=museum to MUSEUM", () => {
      expect(mapOsmCategory({ tourism: "museum" })).toBe(PlaceCategory.MUSEUM);
    });

    it("maps amenity=restaurant to RESTAURANT", () => {
      expect(mapOsmCategory({ amenity: "restaurant" })).toBe(
        PlaceCategory.RESTAURANT
      );
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
      expect(mapOsmCategory({ historic: "monument" })).toBe(
        PlaceCategory.MONUMENT
      );
      expect(mapOsmCategory({ historic: "memorial" })).toBe(
        PlaceCategory.MONUMENT
      );
      expect(mapOsmCategory({ tourism: "attraction" })).toBe(
        PlaceCategory.MONUMENT
      );
      expect(mapOsmCategory({ tourism: "viewpoint" })).toBe(
        PlaceCategory.MONUMENT
      );
    });

    it("maps tourism=gallery to MUSEUM and amenity=coffee_shop to CAFE", () => {
      expect(mapOsmCategory({ tourism: "gallery" })).toBe(PlaceCategory.MUSEUM);
      expect(mapOsmCategory({ amenity: "coffee_shop" })).toBe(
        PlaceCategory.CAFE
      );
    });

    it("maps any historic place (castle, ruins, ...) and churches or cathedrals to MONUMENT", () => {
      for (const historic of [
        "castle",
        "ruins",
        "archaeological_site",
        "yes",
      ]) {
        expect(mapOsmCategory({ historic })).toBe(PlaceCategory.MONUMENT);
      }
      expect(mapOsmCategory({ building: "church" })).toBe(
        PlaceCategory.MONUMENT
      );
      expect(mapOsmCategory({ building: "cathedral" })).toBe(
        PlaceCategory.MONUMENT
      );
    });

    it("keeps the priority: a museum that is also historic is a MUSEUM", () => {
      expect(mapOsmCategory({ tourism: "museum", historic: "building" })).toBe(
        PlaceCategory.MUSEUM
      );
    });

    it("falls back defensively to OTHER for null, undefined, or unrecognized tags", () => {
      expect(mapOsmCategory(null)).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory(undefined)).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory({})).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory({ amenity: "parking" })).toBe(PlaceCategory.OTHER);
      expect(mapOsmCategory({ building: "house" })).toBe(PlaceCategory.OTHER);
    });
  });

  describe("mapOsmPriceLevel", () => {
    it("maps fee=no and fee=0 to FREE", () => {
      expect(mapOsmPriceLevel({ fee: "no" })).toBe("FREE");
      expect(mapOsmPriceLevel({ fee: "0" })).toBe("FREE");
    });

    it("never guesses: every other place has no price level", () => {
      expect(mapOsmPriceLevel(null)).toBeNull();
      expect(mapOsmPriceLevel(undefined)).toBeNull();
      expect(mapOsmPriceLevel({})).toBeNull();
      expect(mapOsmPriceLevel({ fee: "yes" })).toBeNull();
      expect(mapOsmPriceLevel({ fee: "5 EUR" })).toBeNull();
    });

    it("does not guess from the category either", () => {
      for (const tags of [
        { leisure: "park" },
        { tourism: "viewpoint" },
        { historic: "memorial" },
        { tourism: "museum" },
        { amenity: "restaurant" },
      ]) {
        expect(mapOsmPriceLevel(tags), JSON.stringify(tags)).toBeNull();
      }
    });
  });

  describe("openingHoursFromTags", () => {
    it("returns the opening_hours tag as OpenStreetMap writes it", () => {
      expect(openingHoursFromTags({ opening_hours: "Mo-Fr 09:00-18:00" })).toBe(
        "Mo-Fr 09:00-18:00"
      );
    });

    it("trims it", () => {
      expect(openingHoursFromTags({ opening_hours: "  24/7 " })).toBe("24/7");
    });

    it("is null when OpenStreetMap has none: hours are never invented", () => {
      expect(openingHoursFromTags(null)).toBeNull();
      expect(openingHoursFromTags({})).toBeNull();
      expect(openingHoursFromTags({ opening_hours: "" })).toBeNull();
      expect(openingHoursFromTags({ opening_hours: "   " })).toBeNull();
    });
  });

  describe("placeFromNominatim", () => {
    const area: CityArea = {
      name: "Paris",
      minLat: 48.8,
      maxLat: 48.92,
      minLon: 2.22,
      maxLon: 2.47,
    };
    const museum = {
      place_id: 1,
      osm_type: "way",
      osm_id: 4242,
      lat: "48.8606",
      lon: "2.3376",
      name: "  Musée du Louvre ",
      display_name: "Musée du Louvre, Paris",
      class: "tourism",
      type: "museum",
      extratags: { opening_hours: "Mo,We-Su 09:00-18:00", fee: "yes" },
      address: { road: "Rue de Rivoli", postcode: "75001", city: "Paris" },
    };

    it("saves name, category, coordinates, address and opening hours (AC1)", () => {
      expect(placeFromNominatim(museum, area)).toEqual({
        osmId: "way/4242",
        name: "Musée du Louvre",
        description:
          "Musée du Louvre (museum) in Paris, listed on OpenStreetMap.",
        category: PlaceCategory.MUSEUM,
        address: "Rue de Rivoli, 75001, Paris",
        latitude: 48.8606,
        longitude: 2.3376,
        openingHours: "Mo,We-Su 09:00-18:00",
        priceLevel: null,
      });
    });

    it("uses the OpenStreetMap type and id as the id of the place, so a second import finds it (AC2)", () => {
      const again = placeFromNominatim({ ...museum, place_id: 999 }, area);
      expect(again?.osmId).toBe("way/4242");
    });

    it("does not save a place without a name (AC4)", () => {
      expect(placeFromNominatim({ ...museum, name: "" }, area)).toBeNull();
      expect(placeFromNominatim({ ...museum, name: "   " }, area)).toBeNull();
      expect(
        placeFromNominatim({ ...museum, name: undefined }, area)
      ).toBeNull();
    });

    it("gives an unknown category the value OTHER (AC4)", () => {
      const place = placeFromNominatim(
        { ...museum, class: "amenity", type: "parking" },
        area
      );
      expect(place?.category).toBe(PlaceCategory.OTHER);
    });

    it("is FREE only when OpenStreetMap says fee=no, and unknown otherwise (AC5)", () => {
      const free = { ...museum, extratags: { fee: "no" } };
      expect(placeFromNominatim(free, area)?.priceLevel).toBe("FREE");
      expect(placeFromNominatim(museum, area)?.priceLevel).toBeNull();
      const park = { ...museum, class: "leisure", type: "park", extratags: {} };
      expect(placeFromNominatim(park, area)?.priceLevel).toBeNull();
    });

    it("has no opening hours when OpenStreetMap has none", () => {
      const place = placeFromNominatim(
        { ...museum, extratags: undefined },
        area
      );
      expect(place?.openingHours).toBeNull();
    });

    it("does not save a place outside the area of the city, on any of the four sides", () => {
      const outside = [
        { lat: "48.95", lon: "2.35" }, // north of the area
        { lat: "48.75", lon: "2.35" }, // south
        { lat: "48.86", lon: "2.6" }, // east
        { lat: "48.86", lon: "2.1" }, // west
        { lat: "41.15", lon: "-8.61" }, // another city
      ];
      for (const position of outside) {
        expect(
          placeFromNominatim({ ...museum, ...position }, area),
          JSON.stringify(position)
        ).toBeNull();
      }
    });

    it("saves a place inside the area, also one on its border", () => {
      expect(placeFromNominatim(museum, area)).not.toBeNull();
      expect(
        placeFromNominatim({ ...museum, lat: "48.92", lon: "2.47" }, area)
      ).not.toBeNull();
    });

    it("does not save an item without usable coordinates or OpenStreetMap id", () => {
      expect(placeFromNominatim({ ...museum, lat: "x" }, area)).toBeNull();
      expect(
        placeFromNominatim({ ...museum, osm_id: undefined }, area)
      ).toBeNull();
      expect(
        placeFromNominatim({ ...museum, osm_type: undefined }, area)
      ).toBeNull();
      expect(placeFromNominatim(null, area)).toBeNull();
      expect(placeFromNominatim("museum", area)).toBeNull();
    });
  });

  describe("formatNominatimAddress", () => {
    it("joins street and number, postcode and city", () => {
      expect(
        formatNominatimAddress(
          {
            road: "Rua das Flores",
            house_number: "12",
            postcode: "4050-262",
            town: "Porto",
          },
          "Porto"
        )
      ).toBe("Rua das Flores 12, 4050-262, Porto");
    });

    it("falls back to the city name without address details", () => {
      expect(formatNominatimAddress(undefined, "Berlin")).toBe("Berlin");
      expect(formatNominatimAddress({}, "Berlin")).toBe("Berlin");
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
