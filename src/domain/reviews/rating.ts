export const PRICE_LEVELS = ["FREE", "€", "€€", "€€€"] as const;

export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const COST_POINTS: Record<PriceLevel, number> = {
  FREE: 0,
  "€": 1,
  "€€": 2,
  "€€€": 3,
};

/**
 * User-Defined Type Guard verifying if an unknown value is a valid PriceLevel.
 * Leverages the canonical COST_POINTS record as the single source of truth.
 */
export function isPriceLevel(value: unknown): value is PriceLevel {
  return typeof value === "string" && value in COST_POINTS;
}

/**
 * Calculates the arithmetic mean rating rounded to 1 decimal place.
 * Returns null if no valid ratings in range [1, 5] are provided.
 */
export function calculateAverageRating(
  ratings?: readonly number[] | null
): number | null {
  if (!ratings || ratings.length === 0) {
    return null;
  }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < ratings.length; i++) {
    const ratingValue = ratings[i];

    if (ratingValue >= 1 && ratingValue <= 5) {
      sum += ratingValue;
      count++;
    }
  }

  if (count === 0) {
    return null;
  }

  return Number((sum / count).toFixed(1));
}

/**
 * Weight of the prior in the rating score (ADR-008): a place needs about this many reviews before
 * its own average counts as much as the prior.
 */
export const RATING_SCORE_M = 3;

/** The prior of the rating score (ADR-008): the rating that a place with no reviews is assumed to have. */
export const RATING_SCORE_C = 4.0;

/**
 * The number that ranks places (ADR-008, the weighted rating, a Bayesian average):
 * `(n / (n + m)) * average + (m / (n + m)) * C`, rounded to 2 decimals. One review cannot outrank
 * many: 1 review of 5 scores 4.25, and 50 reviews averaging 4.8 score 4.75.
 */
export function ratingScore(
  average: number | null | undefined,
  count: number | null | undefined
): number | null {
  if (
    average == null ||
    count == null ||
    !Number.isFinite(average) ||
    !Number.isFinite(count) ||
    count < 1 ||
    average < 1 ||
    average > 5
  ) {
    return null;
  }

  const weight = count / (count + RATING_SCORE_M);
  const score = weight * average + (1 - weight) * RATING_SCORE_C;
  return Number(score.toFixed(2));
}

/**
 * Calculates the statistical mode of review price levels.
 * In case of a tie between equally frequent levels, the lower price level is
 * chosen.
 */
export function calculatePriceLevelMode(
  levels?: readonly (string | null | undefined)[] | null
): PriceLevel | null {
  if (!levels || levels.length === 0) {
    return null;
  }

  const counts: Record<PriceLevel, number> = {
    FREE: 0,
    "€": 0,
    "€€": 0,
    "€€€": 0,
  };

  let hasValid = false;

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];

    if (isPriceLevel(lvl)) {
      counts[lvl]++;
      hasValid = true;
    }
  }

  if (!hasValid) {
    return null;
  }

  // Iterate over canonical ordered levels to break ties towards lower cost
  let maxCount = 0;
  let mode: PriceLevel = PRICE_LEVELS[0];

  for (let i = 0; i < PRICE_LEVELS.length; i++) {
    const lvl = PRICE_LEVELS[i];

    if (counts[lvl] > maxCount) {
      maxCount = counts[lvl];
      mode = lvl;
    }
  }

  return mode;
}

/**
 * Calculates the average cost points for a set of stops on a day.
 * Safe type narrowing using `isPriceLevel` type guard.
 */
export function calculateAverageCostPoints(
  stops?: readonly { readonly priceLevel?: string | null }[] | null
): number | null {
  if (!stops || stops.length === 0) {
    return null;
  }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < stops.length; i++) {
    const level = stops[i]?.priceLevel;

    if (isPriceLevel(level)) {
      sum += COST_POINTS[level];
      count++;
    }
  }

  if (count === 0) {
    return null;
  }

  return Number((sum / count).toFixed(1));
}
