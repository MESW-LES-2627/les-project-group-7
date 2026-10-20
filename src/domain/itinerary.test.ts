import { describe, it, expect } from "vitest";
import { generateItinerary, type PlaceCandidate, type TripConstraints } from "./itinerary";

describe("Itinerary Generator — Time Packing & Days (TDD)", () => {
  const p1: PlaceCandidate = {
    id: "p1",
    name: "Torre dos Clérigos",
    latitude: 41.1458,
    longitude: -8.6146,
    visitDurationMinutes: 120,
  };

  const p2: PlaceCandidate = {
    id: "p2",
    name: "Livraria Lello",
    latitude: 41.1469,
    longitude: -8.6149,
    visitDurationMinutes: 120,
  };

  const p3: PlaceCandidate = {
    id: "p3",
    name: "Serralves",
    latitude: 41.1596,
    longitude: -8.6596,
    visitDurationMinutes: 180,
  };

  it("schedules places into Day 1 when they fit within the time limit", () => {
    const constraints: TripConstraints = {
      numberOfDays: 1,
      maxHoursPerDay: 5,
    };

    const result = generateItinerary(constraints, [p1, p2]);

    expect(result.days).toHaveLength(1);
    expect(result.days[0].stops).toHaveLength(2);
    expect(result.excludedPlaces).toHaveLength(0);
  });

  it("distributes places across multiple days and moves overflow to excludedPlaces", () => {
    const constraints: TripConstraints = {
      numberOfDays: 2,
      maxHoursPerDay: 3,
    };

    const result = generateItinerary(constraints, [p1, p2, p3]);

    expect(result.days).toHaveLength(2);
    expect(result.days[0].stops).toHaveLength(1);
    expect(result.days[0].stops[0].place.id).toBe("p1");

    expect(result.days[1].stops).toHaveLength(1);
    expect(result.days[1].stops[0].place.id).toBe("p2");

    expect(result.excludedPlaces).toHaveLength(1);
    expect(result.excludedPlaces[0].id).toBe("p3");
  });
});

describe("Itinerary Generator — Budget Constraint (TDD)", () => {
  const pFree: PlaceCandidate = {
    id: "free-1",
    name: "Jardins do Palácio de Cristal",
    latitude: 41.1486,
    longitude: -8.6258,
    priceLevel: "FREE",
    visitDurationMinutes: 60,
  };

  const pCheap: PlaceCandidate = {
    id: "cheap-1",
    name: "Café Santiago",
    latitude: 41.1466,
    longitude: -8.6046,
    priceLevel: "€",
    visitDurationMinutes: 60,
  };

  const pExpensive: PlaceCandidate = {
    id: "exp-1",
    name: "Restaurante Michelin",
    latitude: 41.1500,
    longitude: -8.6100,
    priceLevel: "€€€",
    visitDurationMinutes: 90,
  };

  it("excludes or avoids places that would cause the daily average budget to exceed the limit", () => {
    const constraints: TripConstraints = {
      numberOfDays: 1,
      maxHoursPerDay: 8,
      dailyBudgetLevel: "€",
    };

    const result = generateItinerary(constraints, [pFree, pCheap, pExpensive]);

    const scheduledIds = result.days[0].stops.map((s) => s.place.id);
    expect(scheduledIds).toContain("free-1");
    expect(scheduledIds).toContain("cheap-1");
    expect(scheduledIds).not.toContain("exp-1");
    expect(result.excludedPlaces.map((p) => p.id)).toContain("exp-1");
  });
});

describe("Itinerary Generator — Proximity & Nearest Neighbor (TDD)", () => {
  const clerigos: PlaceCandidate = {
    id: "clerigos",
    name: "Torre dos Clérigos",
    latitude: 41.1458,
    longitude: -8.6146,
    averageRating: 5.0,
    visitDurationMinutes: 60,
  };

  const serralvesFar: PlaceCandidate = {
    id: "serralves",
    name: "Parque de Serralves (Far)",
    latitude: 41.1596,
    longitude: -8.6596, // ~ 4 km from Clérigos
    averageRating: 4.8,
    visitDurationMinutes: 60,
  };

  const lelloNear: PlaceCandidate = {
    id: "lello",
    name: "Livraria Lello (Near)",
    latitude: 41.1469,
    longitude: -8.6149, // ~ 250 meters from Clérigos
    averageRating: 4.7,
    visitDurationMinutes: 60,
  };

  it("picks the nearest available place as the next stop instead of jumping across the city", () => {
    const constraints: TripConstraints = {
      numberOfDays: 1,
      maxHoursPerDay: 8,
    };

    // Input list contains Serralves before Lello
    const candidates = [clerigos, serralvesFar, lelloNear];
    const result = generateItinerary(constraints, candidates);

    const stops = result.days[0].stops;
    expect(stops).toHaveLength(3);
    // 1st stop: Clérigos
    expect(stops[0].place.id).toBe("clerigos");
    // 2nd stop MUST be Lello (nearest neighbor to Clérigos), not Serralves
    expect(stops[1].place.id).toBe("lello");
    // 3rd stop: Serralves
    expect(stops[2].place.id).toBe("serralves");
  });
});
