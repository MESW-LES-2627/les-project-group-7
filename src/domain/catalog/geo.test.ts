import { describe, it, expect } from "vitest";
import {
  haversineDistanceKm,
  estimateWalkingMinutes,
  filterPlacesByBounds,
} from "./geo";

describe("Geographical calculations", () => {
  // Approximate coordinates: Torre dos Clérigos (Porto) to Livraria Lello (Porto) ~ 250m
  const clerigos = { lat: 41.1458, lon: -8.6146 };
  const lello = { lat: 41.1469, lon: -8.6149 };

  it("calculates distance between nearby landmarks in kilometers", () => {
    const dist = haversineDistanceKm(
      clerigos.lat,
      clerigos.lon,
      lello.lat,
      lello.lon
    );
    expect(dist).toBeGreaterThan(0.1);
    expect(dist).toBeLessThan(0.3);
  });

  it("calculates zero distance for the same point", () => {
    const dist = haversineDistanceKm(
      clerigos.lat,
      clerigos.lon,
      clerigos.lat,
      clerigos.lon
    );
    expect(dist).toBe(0);
  });

  it("estimates walking time with realistic detour factor", () => {
    // 1 km straight-line distance: 1 * 1.3 = 1.3 km street walk.
    // 1.3 km / 4.5 km/h * 60 min ≈ 17.3 minutes -> rounds to 17 min.
    const minutes = estimateWalkingMinutes(1.0);
    expect(minutes).toBe(17);
  });

  it("returns 0 minutes for non-positive distances", () => {
    expect(estimateWalkingMinutes(0)).toBe(0);
    expect(estimateWalkingMinutes(-1)).toBe(0);
  });
});

describe("Viewport culling", () => {
  const bounds = {
    south: 41.14,
    west: -8.62,
    north: 41.15,
    east: -8.61,
  };

  const places = [
    { id: "1", latitude: 41.145, longitude: -8.615 },
    { id: "2", latitude: 41.151, longitude: -8.615 },
    { id: "3", latitude: 41.16, longitude: -8.63 },
    { id: "4", latitude: 41.139, longitude: -8.615 },
  ];

  it("includes places inside the viewport", () => {
    const result = filterPlacesByBounds(places, bounds);

    expect(result.map((place) => place.id)).toContain("1");
  });

  it("includes places within the 15% margin", () => {
    const result = filterPlacesByBounds(places, bounds);

    expect(result.map((place) => place.id)).toContain("2");
    expect(result.map((place) => place.id)).toContain("4");
  });

  it("excludes places outside the viewport and margin", () => {
    const result = filterPlacesByBounds(places, bounds);

    expect(result.map((place) => place.id)).not.toContain("3");
  });

  it("supports filtering without a margin", () => {
    const result = filterPlacesByBounds(places, bounds, 0);

    expect(result.map((place) => place.id)).toEqual(["1"]);
  });

  it("returns an empty array when no places are visible", () => {
    const result = filterPlacesByBounds(
      [{ id: "5", latitude: 40, longitude: -9 }],
      bounds
    );

    expect(result).toEqual([]);
  });
});
