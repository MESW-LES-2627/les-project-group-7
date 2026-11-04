import { isPriceLevel, type PriceLevel } from "./rating";

/**
 * Review input validation rules (US-C1-01, #38).
 * Pure function: validates review submission fields according to AC1 and AC4.
 *
 * - AC1: Place ID, rating (1-5), non-empty text, and price level.
 * - AC4: Rating must be an integer between 1 and 5, and text must not be empty.
 */

export interface ReviewInput {
  placeId: string;
  rating: number;
  text: string;
  priceLevel: PriceLevel;
}

export type ReviewField = keyof ReviewInput;

export type ReviewErrors = Partial<Record<ReviewField, string>>;

export type ReviewValidation =
  { ok: true; value: ReviewInput } | { ok: false; errors: ReviewErrors };

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Validates the raw body of a review submission.
 * Returns `{ ok: true, value }` with trimmed text and narrowed types on success,
 * or `{ ok: false, errors }` with actionable error messages per field on failure.
 */
export function validateReviewInput(body: unknown): ReviewValidation {
  const input =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const placeId = asText(input.placeId).trim();
  const text = asText(input.text).trim();
  const rating = input.rating;
  const priceLevel = input.priceLevel;

  const errors: ReviewErrors = {};

  if (placeId === "") {
    errors.placeId = "Place is required";
  }

  const isValidRating =
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5;

  if (!isValidRating) {
    errors.rating = "Rating must be an integer between 1 and 5";
  }

  if (text === "") {
    errors.text = "Review text cannot be empty";
  }

  const isValidPrice = isPriceLevel(priceLevel);
  if (!isValidPrice) {
    errors.priceLevel = "A valid price level is required";
  }

  if (errors.placeId || !isValidRating || errors.text || !isValidPrice) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      placeId,
      rating,
      text,
      priceLevel,
    },
  };
}
