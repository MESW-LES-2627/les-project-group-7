import { describe, it, expect } from "vitest";
import { calculateAverageRating, calculatePriceLevelMode } from "./rating.js";

describe("Rating calculations", () => {
  it("calculates average rating rounded to one decimal place", () => {
    expect(calculateAverageRating([4, 5, 5])).toBe(4.7);
    expect(calculateAverageRating([3, 4])).toBe(3.5);
    expect(calculateAverageRating([5])).toBe(5.0);
  });

  it("handles empty or invalid ratings gracefully", () => {
    expect(calculateAverageRating([])).toBeNull();
    expect(calculateAverageRating([0, 6])).toBeNull();
  });
});

describe("PriceLevel calculations (Mode)", () => {
  it("identifies the single most frequent price level", () => {
    expect(calculatePriceLevelMode(["€", "€€", "€€", "€€€"])).toBe("€€");
    expect(calculatePriceLevelMode(["€", "€", "€€"])).toBe("€");
  });

  it("breaks ties in favor of the lower/conservative price level", () => {
    // Tie between € and €€ -> €
    expect(calculatePriceLevelMode(["€", "€€"])).toBe("€");
    // Tie between €€ and €€€ -> €€
    expect(calculatePriceLevelMode(["€€", "€€€"])).toBe("€€");
  });

  it("ignores null or invalid price level values", () => {
    expect(calculatePriceLevelMode([null, undefined, "invalid", "€€"])).toBe("€€");
    expect(calculatePriceLevelMode([])).toBeNull();
  });
});
