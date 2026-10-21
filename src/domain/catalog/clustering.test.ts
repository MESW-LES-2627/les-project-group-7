import { describe, it, expect } from "vitest";
import { clusterPlaces } from "./clustering";
import type { MapPlace } from "@/components/MapComponent";

describe("clusterPlaces", () => {
  const dummyPlaces: MapPlace[] = [
    {
      id: "p1",
      name: "Torre dos Clerigos",
      category: "MONUMENT",
      priceLevel: "€",
      rating: 4.8,
      latitude: 41.1458,
      longitude: -8.6146,
    },
    {
      id: "p2",
      name: "Livraria Lello",
      category: "MONUMENT",
      priceLevel: "€",
      rating: 4.6,
      latitude: 41.1468,
      longitude: -8.6148,
    },
    {
      id: "p3",
      name: "Parque da Cidade",
      category: "PARK",
      priceLevel: "FREE",
      rating: 4.9,
      latitude: 41.168,
      longitude: -8.678,
    },
  ];

  it("returns empty results for empty place array", () => {
    const result = clusterPlaces([], 14);
    expect(result.singlePins).toEqual([]);
    expect(result.clusters).toEqual([]);
  });

  it("returns individual pin when only 1 place exists", () => {
    const result = clusterPlaces([dummyPlaces[0]], 12);
    expect(result.singlePins.length).toBe(1);
    expect(result.clusters.length).toBe(0);
    expect(result.singlePins[0].id).toBe("p1");
  });

  it("clusters nearby downtown places (Clerigos & Lello) when zoomed out at zoom 13", () => {
    const result = clusterPlaces(dummyPlaces, 13);

    // Clerigos and Lello (~100m apart) should cluster together
    expect(result.clusters.length).toBe(1);
    expect(result.clusters[0].count).toBe(2);
    expect(result.clusters[0].places.map((p) => p.id)).toEqual(["p1", "p2"]);

    // Parque da Cidade (~6km away) should remain a single pin
    expect(result.singlePins.length).toBe(1);
    expect(result.singlePins[0].id).toBe("p3");
  });

  it("unclusters all places into individual pins at street level (zoom >= 16)", () => {
    const result = clusterPlaces(dummyPlaces, 16);

    expect(result.clusters.length).toBe(0);
    expect(result.singlePins.length).toBe(3);
  });
});
