import { describe, it, expect } from "vitest";
import { chosenStars, starCounts } from "./review-filter";

const ratings = (...values: number[]) => values.map((rating) => ({ rating }));

describe("starCounts: the buttons of the filter by stars (#187)", () => {
  it("counts the reviews of each rating, 5 stars first, only the ratings that have reviews", () => {
    expect(starCounts(ratings(5, 4, 5, 1, 5, 4))).toEqual([
      { stars: 5, count: 3 },
      { stars: 4, count: 2 },
      { stars: 1, count: 1 },
    ]);
  });

  it("is empty without reviews", () => {
    expect(starCounts([])).toEqual([]);
  });
});

describe("chosenStars: the rating of the address (#187)", () => {
  const counts = [
    { stars: 5, count: 3 },
    { stars: 1, count: 1 },
  ];

  it("is the rating when it has reviews", () => {
    expect(chosenStars("5", counts)).toBe(5);
    expect(chosenStars(["1", "5"], counts)).toBe(1);
  });

  it("is null, all reviews, for none, a rating without reviews or anything else", () => {
    for (const value of [undefined, "", "2", "6", "0", "five", "4.5"]) {
      expect(chosenStars(value, counts)).toBeNull();
    }
  });
});
