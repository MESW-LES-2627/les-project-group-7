import { describe, it, expect } from "vitest";
import {
  validateReviewInput,
  type ReviewValidation,
} from "./review-validation";
import { PRICE_LEVELS } from "./rating";

describe("validateReviewInput", () => {
  const validInput = {
    placeId: "place-1",
    rating: 5,
    text: "Great experience!",
    priceLevel: "€€",
  };

  it("accepts valid input with all required fields", () => {
    const result = validateReviewInput(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        placeId: "place-1",
        rating: 5,
        text: "Great experience!",
        priceLevel: "€€",
      });
    }
  });

  it("trims the review text", () => {
    const result = validateReviewInput({
      ...validInput,
      text: "  Nice atmosphere   ",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.text).toBe("Nice atmosphere");
    }
  });

  it("accepts all valid price levels", () => {
    for (const level of PRICE_LEVELS) {
      const result = validateReviewInput({
        ...validInput,
        priceLevel: level,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.priceLevel).toBe(level);
      }
    }
  });

  it("rejects non-object or null input", () => {
    expect(validateReviewInput(null).ok).toBe(false);
    expect(validateReviewInput(undefined).ok).toBe(false);
    expect(validateReviewInput("string").ok).toBe(false);
  });

  describe("placeId validation", () => {
    it("rejects missing or empty placeId", () => {
      const result = validateReviewInput({ ...validInput, placeId: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.placeId).toBe("Place is required");
      }
    });

    it("rejects placeId with only whitespace", () => {
      const result = validateReviewInput({ ...validInput, placeId: "   " });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.placeId).toBe("Place is required");
      }
    });
  });

  describe("rating validation (AC4)", () => {
    it("rejects ratings less than 1", () => {
      const result = validateReviewInput({ ...validInput, rating: 0 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.rating).toBe(
          "Rating must be an integer between 1 and 5"
        );
      }
    });

    it("rejects ratings greater than 5", () => {
      const result = validateReviewInput({ ...validInput, rating: 6 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.rating).toBe(
          "Rating must be an integer between 1 and 5"
        );
      }
    });

    it("rejects non-integer ratings", () => {
      const result = validateReviewInput({ ...validInput, rating: 4.5 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.rating).toBe(
          "Rating must be an integer between 1 and 5"
        );
      }
    });

    it("rejects non-number ratings", () => {
      const result = validateReviewInput({ ...validInput, rating: "5" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.rating).toBe(
          "Rating must be an integer between 1 and 5"
        );
      }
    });
  });

  describe("text validation (AC4)", () => {
    it("rejects empty text", () => {
      const result = validateReviewInput({ ...validInput, text: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.text).toBe("Review text cannot be empty");
      }
    });

    it("rejects text that is only whitespace", () => {
      const result = validateReviewInput({ ...validInput, text: "    \n\t " });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.text).toBe("Review text cannot be empty");
      }
    });

    it("rejects non-string text", () => {
      const result = validateReviewInput({ ...validInput, text: 12345 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.text).toBe("Review text cannot be empty");
      }
    });
  });

  describe("price level validation (AC1)", () => {
    it("rejects invalid price level string", () => {
      const result = validateReviewInput({
        ...validInput,
        priceLevel: "$$$",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.priceLevel).toBe(
          "A valid price level is required"
        );
      }
    });

    it("rejects missing price level", () => {
      const result = validateReviewInput({
        ...validInput,
        priceLevel: undefined,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.priceLevel).toBe(
          "A valid price level is required"
        );
      }
    });
  });
});
