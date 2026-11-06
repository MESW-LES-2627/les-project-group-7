import { describe, it, expect } from "vitest";
import {
  newestFirst,
  formatAverageRating,
  formatReviewCount,
} from "./place-details";

const r = (id: string, iso: string) => ({ id, createdAt: new Date(iso) });

describe("newestFirst (AC3)", () => {
  it("puts the newest review first", () => {
    const list = [
      r("a", "2026-01-01"),
      r("b", "2026-03-01"),
      r("c", "2026-02-01"),
    ];

    expect(newestFirst(list).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks a tie on the same date by id, so the order is stable", () => {
    const list = [
      r("a", "2026-01-01T10:00:00Z"),
      r("b", "2026-01-01T10:00:00Z"),
    ];

    expect(newestFirst(list).map((x) => x.id)).toEqual(["b", "a"]);
    expect(newestFirst([...list].reverse()).map((x) => x.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("does not change the list it gets", () => {
    const list = [r("a", "2026-01-01"), r("b", "2026-03-01")];

    newestFirst(list);

    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("returns an empty list for no reviews", () => {
    expect(newestFirst([])).toEqual([]);
  });
});

describe("formatAverageRating (AC1)", () => {
  it("shows the average with one decimal", () => {
    expect(formatAverageRating(4.25)).toBe("4.3");
    expect(formatAverageRating(5)).toBe("5.0");
    expect(formatAverageRating(1)).toBe("1.0");
  });

  it("shows no rating for a missing or impossible average", () => {
    expect(formatAverageRating(null)).toBe("No rating yet");
    expect(formatAverageRating(undefined)).toBe("No rating yet");
    expect(formatAverageRating(0)).toBe("No rating yet");
    expect(formatAverageRating(5.5)).toBe("No rating yet");
    expect(formatAverageRating(Number.NaN)).toBe("No rating yet");
  });
});

describe("formatReviewCount (AC1, AC4)", () => {
  it("says there are no reviews yet for zero", () => {
    expect(formatReviewCount(0)).toBe("No reviews yet");
  });

  it("uses singular and plural", () => {
    expect(formatReviewCount(1)).toBe("1 review");
    expect(formatReviewCount(12)).toBe("12 reviews");
  });

  it("treats a negative or non-number count as no reviews", () => {
    expect(formatReviewCount(-1)).toBe("No reviews yet");
    expect(formatReviewCount(Number.NaN)).toBe("No reviews yet");
  });
});
