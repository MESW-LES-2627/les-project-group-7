import { describe, it, expect } from "vitest";
import {
  calculateAverageRating,
  calculatePriceLevelMode,
  calculateAverageCostPoints,
} from "./rating";

describe("Rating calculations", () => {
  it("calculates average rating rounded to one decimal place", () => {
    expect(calculateAverageRating([4, 5, 4])).toBe(4.3);
    expect(calculateAverageRating([5, 5, 5])).toBe(5.0);
    expect(calculateAverageRating([1, 2])).toBe(1.5);
  });

  it("filters out invalid ratings outside 1..5 range", () => {
    expect(calculateAverageRating([0, 5, 6])).toBe(5.0);
    expect(calculateAverageRating([])).toBeNull();
  });
});

describe("PriceLevel calculations (Mode)", () => {
  it("finds the most frequent price level", () => {
    expect(calculatePriceLevelMode(["€", "€€", "€€"])).toBe("€€");
    expect(calculatePriceLevelMode(["€€€", "€€€", "€"])).toBe("€€€");
  });

  it("breaks ties in favor of the lower/conservative price level", () => {
    // Tie between FREE and € -> FREE
    expect(calculatePriceLevelMode(["FREE", "€"])).toBe("FREE");
    // Tie between € and €€ -> €
    expect(calculatePriceLevelMode(["€", "€€"])).toBe("€");
    // Tie between €€ and €€€ -> €€
    expect(calculatePriceLevelMode(["€€", "€€€"])).toBe("€€");
  });

  it("handles empty or invalid inputs gracefully", () => {
    expect(calculatePriceLevelMode(["INVALID", null, undefined])).toBeNull();
    expect(calculatePriceLevelMode([])).toBeNull();
  });
});

describe("Cost points and Soft Daily Budget calculation", () => {
  it("calculates daily average cost points correctly", () => {
    // 2 free attractions (0) + 1 moderate dinner (2) = 2 / 3 ≈ 0.7 (fits in € budget <= 1.0)
    const dayStops = [
      { priceLevel: "FREE" },
      { priceLevel: "FREE" },
      { priceLevel: "€€" },
    ];
    expect(calculateAverageCostPoints(dayStops)).toBe(0.7);
  });

  it("excludes unknown/null prices from the average", () => {
    const dayStops = [
      { priceLevel: "FREE" },
      { priceLevel: null },
      { priceLevel: "€€" },
    ];
    // 0 + 2 = 2 / 2 = 1.0
    expect(calculateAverageCostPoints(dayStops)).toBe(1.0);
  });

  it("returns null if no stops have known pricing", () => {
    expect(calculateAverageCostPoints([{ priceLevel: null }])).toBeNull();
    expect(calculateAverageCostPoints([])).toBeNull();
  });
});
