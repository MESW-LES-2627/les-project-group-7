import { isPriceLevel, type PriceLevel } from "./rating";

/**
 * Validation of a change to a review of the user (US-C2-01, #40). Pure function: only the fields that
 * are sent are checked and changed, with the same rules as when the review is written (US-C1-01): a
 * rating is an integer from 1 to 5, the text is not empty and the price level is one of the five.
 *
 * Like the validation of a new review, a wrong field gets its own message in `errors`, so the person
 * sees everything to fix at once. `error` is the first message. A body that is not an object, has
 * nothing to change or tries to change the owner or the place has only `error`.
 */

export interface ReviewUpdateInput {
  rating?: number;
  text?: string;
  priceLevel?: PriceLevel;
}

export type ReviewUpdateField = keyof ReviewUpdateInput;

export type ReviewUpdateErrors = Partial<Record<ReviewUpdateField, string>>;

export type ReviewUpdateValidation =
  | { ok: true; value: ReviewUpdateInput }
  | { ok: false; error: string; errors?: ReviewUpdateErrors };

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
  const errors: ReviewUpdateErrors = {};

  if ("rating" in input) {
    if (
      typeof input.rating !== "number" ||
      !Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5
    ) {
      errors.rating = "Rating must be an integer between 1 and 5";
    } else {
      value.rating = input.rating;
    }
  }

  if ("text" in input) {
    if (typeof input.text !== "string" || input.text.trim() === "") {
      errors.text = "Review text cannot be empty";
    } else {
      value.text = input.text.trim();
    }
  }

  if ("priceLevel" in input) {
    if (!isPriceLevel(input.priceLevel)) {
      errors.priceLevel = "A valid price level is required";
    } else {
      value.priceLevel = input.priceLevel;
    }
  }

  const [firstError] = Object.values(errors);
  if (firstError !== undefined) {
    return { ok: false, error: firstError, errors };
  }

  return { ok: true, value };
}
