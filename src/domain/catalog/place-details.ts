/**
 * Pure rules for the place details view (US-B4-01, #29):
 * sorting reviews chronologically and formatting ratings and review counts.
 */

/**
 * Returns a new array with reviews sorted newest first (descending createdAt),
 * breaking ties deterministically by id (descending) so order is stable across reloads.
 */
export function newestFirst<T extends { id: string; createdAt: Date }>(
  reviews: readonly T[]
): T[] {
  return [...reviews].sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();

    if (timeDiff !== 0) return timeDiff;

    return b.id.localeCompare(a.id);
  });
}

/**
 * Formats arithmetic average rating rounded to 1 decimal place,
 * or returns "No rating yet" if missing, invalid, or out of [1, 5] range.
 */
export function formatAverageRating(
  average: number | null | undefined
): string {
  if (
    average == null ||
    !Number.isFinite(average) ||
    average < 1 ||
    average > 5
  ) {
    return "No rating yet";
  }

  return average.toFixed(1);
}

/**
 * Formats review count in English with singular/plural agreement,
 * or returns "No reviews yet" when 0, negative, or not a finite number.
 */
export function formatReviewCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return "No reviews yet";
  }

  return count === 1 ? "1 review" : `${count} reviews`;
}
