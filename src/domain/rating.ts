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
 * Employs single-pass O(N) iteration with O(1) memory overhead.
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
    const r = ratings[i];

    if (r >= 1 && r <= 5) {
      sum += r;
      count++;
    }
  }

  if (count === 0) {
    return null;
  }

  return Number((sum / count).toFixed(1));
}

/**
 * Calculates the statistical mode (most frequent value) of review price levels.
 * In case of a tie between equally frequent levels, the lower price level is
 * chosen (conservative estimate).
 * O(N) single-pass frequency count without intermediate array allocations.
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
 * Single-pass accumulator with O(1) memory overhead.
 * Safe type narrowing using `isPriceLevel` type guard (no `as PriceLevel` cast).
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
