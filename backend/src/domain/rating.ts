export type PriceLevel = "€" | "€€" | "€€€";

/**
 * Calculates the arithmetic mean rating rounded to 1 decimal place.
 * Returns null if no ratings are provided.
 */
export function calculateAverageRating(ratings: number[]): number | null {
  if (!ratings || ratings.length === 0) return null;
  const validRatings = ratings.filter((r) => r >= 1 && r <= 5);
  if (validRatings.length === 0) return null;

  const sum = validRatings.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / validRatings.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Calculates the statistical mode (most frequent value) of review price levels.
 * In case of a tie between two equally frequent levels, the lower price level is chosen (conservative).
 * Returns null if no price levels are provided.
 */
export function calculatePriceLevelMode(
  levels: (PriceLevel | string | null | undefined)[]
): PriceLevel | null {
  if (!levels || levels.length === 0) return null;

  const validLevels = levels.filter(
    (lvl): lvl is PriceLevel => lvl === "€" || lvl === "€€" || lvl === "€€€"
  );
  if (validLevels.length === 0) return null;

  const counts: Record<PriceLevel, number> = {
    "€": 0,
    "€€": 0,
    "€€€": 0,
  };

  for (const lvl of validLevels) {
    counts[lvl] = (counts[lvl] || 0) + 1;
  }

  // Find maximum frequency
  let maxCount = 0;
  let mode: PriceLevel = "€";

  // Check in order of ascending price so lower level is preferred on tie
  const candidateOrder: PriceLevel[] = ["€", "€€", "€€€"];
  for (const lvl of candidateOrder) {
    if (counts[lvl] > maxCount) {
      maxCount = counts[lvl];
      mode = lvl;
    }
  }

  return maxCount > 0 ? mode : null;
}
