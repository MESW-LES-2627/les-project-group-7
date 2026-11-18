import { isPriceLevel, type PriceLevel } from "./rating";

export interface ReviewUpdateInput {
  rating?: number;
  text?: string;
  priceLevel?: PriceLevel;
}

export type ReviewUpdateValidation =
  { ok: true; value: ReviewUpdateInput } | { ok: false; error: string };

export function validateReviewUpdateInput(
  body: unknown
): ReviewUpdateValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid review input" };
  }

  const input = body as Record<string, unknown>;

  if ("userId" in input || "placeId" in input || "id" in input) {
    return {
      ok: false,
      error: "Review ownership and place cannot be changed",
    };
  }

  if (!["rating", "text", "priceLevel"].some((field) => field in input)) {
    return { ok: false, error: "No review fields provided" };
  }

  const value: ReviewUpdateInput = {};

  if ("rating" in input) {
    if (
      typeof input.rating !== "number" ||
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      return {
        ok: false,
        error: "Rating must be an integer between 1 and 5",
      };
    }
    value.rating = input.rating;
  }

  if ("text" in input) {
    if (typeof input.text !== "string" || input.text.trim() === "") {
      return { ok: false, error: "Review text cannot be empty" };
    }
    value.text = input.text.trim();
  }

  if ("priceLevel" in input) {
    if (!isPriceLevel(input.priceLevel)) {
      return { ok: false, error: "A valid price level is required" };
    }
    value.priceLevel = input.priceLevel;
  }

  return { ok: true, value };
}
