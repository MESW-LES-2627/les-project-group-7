import { describe, expect, it } from "vitest";
import { calculateTripAverage } from "./trip-average";

describe("calculateTripAverage", () => {
  it("calculates the average price across all trip stops", () => {
    const result = calculateTripAverage([
      { priceLevel: "FREE" },
      { priceLevel: "€" },
      { priceLevel: "€€" },
      { priceLevel: "€€€" },
    ]);

    expect(result).toEqual({
      averageCostPoints: 1.5,
      knownPriceCount: 4,
      unknownPriceCount: 0,
      isOverBudget: false,
    });
  });

  it("excludes unknown prices without treating them as free", () => {
    const result = calculateTripAverage([
      { priceLevel: "FREE" },
      { priceLevel: null },
      { priceLevel: "€€" },
      { priceLevel: undefined },
    ]);

    expect(result.averageCostPoints).toBe(1);
    expect(result.knownPriceCount).toBe(2);
    expect(result.unknownPriceCount).toBe(2);
  });

  it("treats invalid price levels as unknown", () => {
    const result = calculateTripAverage([
      { priceLevel: "€€€" },
      { priceLevel: "INVALID" },
      { priceLevel: "" },
    ]);

    expect(result.averageCostPoints).toBe(3);
    expect(result.knownPriceCount).toBe(1);
    expect(result.unknownPriceCount).toBe(2);
  });

  it("returns an unknown average when all prices are unknown", () => {
    const result = calculateTripAverage(
      [{ priceLevel: null }, { priceLevel: undefined }],
      "€"
    );

    expect(result.averageCostPoints).toBeNull();
    expect(result.knownPriceCount).toBe(0);
    expect(result.unknownPriceCount).toBe(2);
    expect(result.isOverBudget).toBe(false);
  });

  it("handles a trip with no stops", () => {
    expect(calculateTripAverage([], "€")).toEqual({
      averageCostPoints: null,
      knownPriceCount: 0,
      unknownPriceCount: 0,
      isOverBudget: false,
    });
  });

  it("warns when the average exceeds the trip budget", () => {
    const result = calculateTripAverage(
      [{ priceLevel: "€€" }, { priceLevel: "€€€" }],
      "€"
    );

    expect(result.averageCostPoints).toBe(2.5);
    expect(result.isOverBudget).toBe(true);
  });

  it("does not warn when the average equals the budget", () => {
    const result = calculateTripAverage(
      [{ priceLevel: "€" }, { priceLevel: "€€€" }],
      "€€"
    );

    expect(result.averageCostPoints).toBe(2);
    expect(result.isOverBudget).toBe(false);
  });

  it("does not warn when the average is below the budget", () => {
    const result = calculateTripAverage(
      [{ priceLevel: "FREE" }, { priceLevel: "€" }],
      "€€"
    );

    expect(result.isOverBudget).toBe(false);
  });

  it("does not warn when no budget is defined", () => {
    const result = calculateTripAverage([
      { priceLevel: "€€€" },
      { priceLevel: "€€€" },
    ]);

    expect(result.averageCostPoints).toBe(3);
    expect(result.isOverBudget).toBe(false);
  });

  it("does not warn for unknown prices even with a budget", () => {
    const result = calculateTripAverage([{ priceLevel: null }], "€");

    expect(result.averageCostPoints).toBeNull();
    expect(result.isOverBudget).toBe(false);
  });
});
