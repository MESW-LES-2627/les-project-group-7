/**
 * The messages of the forms that write and edit a review (US-P1-02, #187): what is missing, said next
 * to the field, and why a request failed, in plain words (AC3).
 */

export type ReviewFormField = "rating" | "priceLevel" | "text";

export type ReviewFormErrors = Partial<Record<ReviewFormField, string>>;

export const RATING_MISSING = "Choose a rating from 1 to 5";
export const PRICE_LEVEL_MISSING = "Choose how much it costs";
export const TEXT_MISSING = "Write a few words about the place";

/** The message when the request did not reach the server (the same words as the login page). */
export const NETWORK_ERROR = "Could not reach the server, try again";

/**
 * What is missing in a review form, one message for each missing field.
 *
 * @param options.priceLevelRequired false when editing a review written before the price level existed
 */
export function reviewFormErrors(
  values: { rating: number | null; priceLevel: string | null; text: string },
  { priceLevelRequired = true }: { priceLevelRequired?: boolean } = {}
): ReviewFormErrors {
  const errors: ReviewFormErrors = {};

  const { rating } = values;
  if (
    rating === null ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    errors.rating = RATING_MISSING;
  }
  if (priceLevelRequired && !values.priceLevel) {
    errors.priceLevel = PRICE_LEVEL_MISSING;
  }
  if (!values.text.trim()) {
    errors.text = TEXT_MISSING;
  }

  return errors;
}

/**
 * The message of a request that failed: the server's own message when it sends one, the network
 * message when the request did not get through (fetch throws a TypeError), or else the fallback.
 *
 * @param failure the JSON body of the answer, or what fetch threw
 * @param fallback the message of the action, like "Could not post the review, try again"
 */
export function failureMessage(failure: unknown, fallback: string): string {
  if (failure instanceof TypeError) return NETWORK_ERROR;

  if (typeof failure === "object" && failure !== null && "error" in failure) {
    const { error } = failure as { error: unknown };
    if (typeof error === "string" && error.trim()) return error;
  }

  return fallback;
}
