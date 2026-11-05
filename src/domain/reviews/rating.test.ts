import { describe, it, expect } from "vitest";
import {
  calculateAverageRating,
  calculatePlacePriceLevel,
  calculatePriceLevelMode,
  calculateAverageCostPoints,
  formatPriceLevel,
  isPriceLevel,
  PAID_REVIEWS_TO_LEAVE_FREE,
  PRICE_LEVELS,
  RATING_SCORE_C,
  RATING_SCORE_M,
  ratingScore,
} from "./rating";

describe("Rating calculations", () => {
  it("calculates average rating rounded to one decimal place", () => {
    expect(calculateAverageRating([4, 5, 4])).toBe(4.3);
    expect(calculateAverageRating([5, 5, 5])).toBe(5.0);
    expect(calculateAverageRating([1, 2])).toBe(1.5);
  });

  it("rounds half up, also where the decimal cannot be stored exactly", () => {
    // 13 ratings of 4 and 7 of 5: the mean is exactly 4.35
    const ratings = [...Array(13).fill(4), ...Array(7).fill(5)];
    expect(calculateAverageRating(ratings)).toBe(4.4);
    expect(calculateAverageRating([4, 5, 4, 4])).toBe(4.3); // 4.25
    expect(calculateAverageRating([1, 1, 2])).toBe(1.3); // 1.33
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

describe("calculatePlacePriceLevel", () => {
  it("uses the most common price level of the reviews", () => {
    expect(calculatePlacePriceLevel("€", ["€€", "€€", "€"])).toBe("€€");
    expect(calculatePlacePriceLevel(null, ["€€€"])).toBe("€€€");
  });

  it("keeps the level the place had when no review gives a price", () => {
    expect(calculatePlacePriceLevel("€€", [])).toBe("€€");
    expect(calculatePlacePriceLevel("FREE", [null, "INVALID"])).toBe("FREE");
    expect(calculatePlacePriceLevel(null, [])).toBeNull();
    expect(calculatePlacePriceLevel("INVALID", [])).toBeNull();
  });

  it("keeps a FREE place FREE when only one review says it is paid", () => {
    expect(PAID_REVIEWS_TO_LEAVE_FREE).toBe(2);
    expect(calculatePlacePriceLevel("FREE", ["€€€"])).toBe("FREE");
    expect(calculatePlacePriceLevel("FREE", ["€", "FREE", "FREE"])).toBe(
      "FREE"
    );
  });

  it("changes a FREE place once two reviews say it is paid", () => {
    expect(calculatePlacePriceLevel("FREE", ["€€", "€€"])).toBe("€€");
    // two paid reviews against one FREE: the most common paid level wins as usual
    expect(calculatePlacePriceLevel("FREE", ["€", "€", "FREE"])).toBe("€");
    // two paid reviews that differ: the tie goes to the lower level
    expect(calculatePlacePriceLevel("FREE", ["€", "€€€"])).toBe("€");
  });

  it("keeps a FREE place FREE when its reviews say FREE", () => {
    expect(calculatePlacePriceLevel("FREE", ["FREE", "FREE", "€"])).toBe(
      "FREE"
    );
  });

  it("does not hold a paid place back: only a FREE place needs two reviews", () => {
    expect(calculatePlacePriceLevel("€", ["€€€"])).toBe("€€€");
  });
});

describe("PriceLevel domain constants and type guard", () => {
  it("exports canonical price levels tuple", () => {
    expect(PRICE_LEVELS).toEqual(["FREE", "€", "€€", "€€€"]);
  });

  it("correctly identifies valid PriceLevel strings", () => {
    expect(isPriceLevel("FREE")).toBe(true);
    expect(isPriceLevel("€")).toBe(true);
    expect(isPriceLevel("€€")).toBe(true);
    expect(isPriceLevel("€€€")).toBe(true);
  });

  it("rejects invalid price levels", () => {
    expect(isPriceLevel("$$$")).toBe(false);
    expect(isPriceLevel(null)).toBe(false);
    expect(isPriceLevel(undefined)).toBe(false);
    expect(isPriceLevel(123)).toBe(false);
  });
});

describe("Rating score (weighted rating, ADR-008)", () => {
  it("uses the constants of the ADR", () => {
    expect(RATING_SCORE_M).toBe(3);
    expect(RATING_SCORE_C).toBe(4.0);
  });

  it("gives 4.25 to 1 review of 5", () => {
    expect(ratingScore(5, 1)).toBe(4.25);
  });

  it("gives 4.5 to 3 reviews of 5", () => {
    expect(ratingScore(5, 3)).toBe(4.5);
  });

  it("gives 4.75 to 50 reviews averaging 4.8", () => {
    expect(ratingScore(4.8, 50)).toBe(4.75);
  });

  it("ranks 50 reviews averaging 4.8 above 1 review of 5", () => {
    expect(ratingScore(4.8, 50)!).toBeGreaterThan(ratingScore(5, 1)!);
  });

  it("pulls a low average up towards 4.0 and keeps a few bad reviews low", () => {
    expect(ratingScore(1, 1)).toBe(3.25);
    expect(ratingScore(1, 50)).toBeLessThan(ratingScore(1, 1)!);
  });

  it("is the prior when the average equals it, whatever the count", () => {
    expect(ratingScore(4, 1)).toBe(4);
    expect(ratingScore(4, 200)).toBe(4);
  });

  it("approaches the plain average as the reviews grow", () => {
    expect(ratingScore(4.8, 100000)).toBeCloseTo(4.8, 1);
  });

  it("has no score for a place without reviews", () => {
    expect(ratingScore(null, 0)).toBeNull();
    expect(ratingScore(undefined, undefined)).toBeNull();
    expect(ratingScore(4.5, 0)).toBeNull();
  });

  it("has no score for an average outside 1..5 or a count that is not a number", () => {
    expect(ratingScore(0, 3)).toBeNull();
    expect(ratingScore(5.5, 3)).toBeNull();
    expect(ratingScore(Number.NaN, 3)).toBeNull();
    expect(ratingScore(4.5, Number.NaN)).toBeNull();
    expect(ratingScore(4.5, -2)).toBeNull();
  });

  it("is rounded to 2 decimals", () => {
    // 2 reviews averaging 4.3: (2/5)*4.3 + (3/5)*4 = 4.12
    expect(ratingScore(4.3, 2)).toBe(4.12);
    // 7 reviews averaging 3.7: (7/10)*3.7 + (3/10)*4 = 3.79
    expect(ratingScore(3.7, 7)).toBe(3.79);
  });
});

describe("formatPriceLevel", () => {
  it("shows FREE as Free and the other levels as they are", () => {
    expect(formatPriceLevel("FREE")).toBe("Free");
    expect(formatPriceLevel("€")).toBe("€");
    expect(formatPriceLevel("€€")).toBe("€€");
    expect(formatPriceLevel("€€€")).toBe("€€€");
  });

  it("shows a place without a price level as unknown, never as Free", () => {
    expect(formatPriceLevel(null)).toBe("Price unknown");
    expect(formatPriceLevel(undefined)).toBe("Price unknown");
    expect(formatPriceLevel("")).toBe("Price unknown");
    expect(formatPriceLevel("cheap")).toBe("Price unknown");
  });
});
