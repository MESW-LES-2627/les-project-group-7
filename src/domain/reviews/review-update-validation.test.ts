import { describe, it, expect } from "vitest";
import { validateReviewUpdateInput } from "./review-update-validation";

describe("validateReviewUpdateInput", () => {
  it("accepts one field and returns only that field", () => {
    expect(validateReviewUpdateInput({ rating: 4 })).toEqual({
      ok: true,
      value: { rating: 4 },
    });
    expect(validateReviewUpdateInput({ priceLevel: "€€" })).toEqual({
      ok: true,
      value: { priceLevel: "€€" },
    });
  });

  it("accepts the three fields and trims the text", () => {
    expect(
      validateReviewUpdateInput({
        rating: 1,
        text: "  Not as good  ",
        priceLevel: "FREE",
      })
    ).toEqual({
      ok: true,
      value: { rating: 1, text: "Not as good", priceLevel: "FREE" },
    });
  });

  it("accepts every rating from 1 to 5 and every price level", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(validateReviewUpdateInput({ rating }).ok).toBe(true);
    }
    for (const priceLevel of ["FREE", "€", "€€", "€€€"]) {
      expect(validateReviewUpdateInput({ priceLevel }).ok).toBe(true);
    }
  });

  it("ignores fields that are not part of a review", () => {
    expect(
      validateReviewUpdateInput({ rating: 3, createdAt: "2000-01-01" })
    ).toEqual({ ok: true, value: { rating: 3 } });
  });

  it("refuses a rating that is not an integer from 1 to 5", () => {
    for (const rating of [0, 6, -1, 2.5, "3", null, true, Number.NaN]) {
      const result = validateReviewUpdateInput({ rating });

      expect(result).toEqual({
        ok: false,
        error: "Rating must be an integer between 1 and 5",
        errors: { rating: "Rating must be an integer between 1 and 5" },
      });
    }
  });

  it("refuses an empty text or one that is not text", () => {
    for (const text of ["", "   ", 5, null, {}]) {
      const result = validateReviewUpdateInput({ text });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors?.text).toBe(
        "Review text cannot be empty"
      );
    }
  });

  it("refuses a price level that is not one of the four", () => {
    for (const priceLevel of ["$", "€€€€", "", null, 2, "free"]) {
      const result = validateReviewUpdateInput({ priceLevel });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors?.priceLevel).toBe(
        "A valid price level is required"
      );
    }
  });

  it("gives one message for each wrong field, so everything can be fixed at once", () => {
    const result = validateReviewUpdateInput({
      rating: 9,
      text: " ",
      priceLevel: "x",
    });

    expect(result).toEqual({
      ok: false,
      error: "Rating must be an integer between 1 and 5",
      errors: {
        rating: "Rating must be an integer between 1 and 5",
        text: "Review text cannot be empty",
        priceLevel: "A valid price level is required",
      },
    });
  });

  it("changes nothing when one field is right and another is wrong", () => {
    const result = validateReviewUpdateInput({ rating: 5, text: "" });

    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors ?? {})).toEqual(["text"]);
  });

  it("refuses to change the owner, the place or the id", () => {
    for (const body of [
      { userId: "u2", rating: 5 },
      { placeId: "p2", rating: 5 },
      { id: "r2", rating: 5 },
    ]) {
      expect(validateReviewUpdateInput(body)).toEqual({
        ok: false,
        error: "Review ownership and place cannot be changed",
      });
    }
  });

  it("refuses a body with nothing to change", () => {
    expect(validateReviewUpdateInput({})).toEqual({
      ok: false,
      error: "No review fields provided",
    });
    expect(validateReviewUpdateInput({ foo: 1 })).toEqual({
      ok: false,
      error: "No review fields provided",
    });
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, undefined, [], "text", 5, true]) {
      expect(validateReviewUpdateInput(body)).toEqual({
        ok: false,
        error: "Invalid review input",
      });
    }
  });
});
