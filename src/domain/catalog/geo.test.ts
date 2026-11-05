import { describe, it, expect } from "vitest";
import { haversineDistanceKm, estimateWalkingMinutes } from "./geo";

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
