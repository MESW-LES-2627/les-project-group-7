/**
 * The filter by stars of the reviews of a place (#187): all reviews by default, or only the reviews of
 * one rating, chosen in the address (`?stars=5`). Only the ratings that have reviews are offered, and a
 * rating of the address without reviews is all reviews, so the filter never shows an empty list.
 */

export interface StarCount {
  stars: number;
  count: number;
}

/** How many reviews have each rating, 5 stars first, leaving out the ratings with none. */
export function starCounts(
  reviews: readonly { rating: number }[]
): StarCount[] {
  return [5, 4, 3, 2, 1]
    .map((stars) => ({
      stars,
      count: reviews.filter((review) => review.rating === stars).length,
    }))
    .filter((entry) => entry.count > 0);
}

/** The rating chosen in the address, or null for all reviews. */
export function chosenStars(
  param: string | string[] | undefined | null,
  counts: readonly StarCount[]
): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (raw == null || !/^[1-5]$/.test(raw)) return null;

  const stars = Number(raw);
  return counts.some((entry) => entry.stars === stars) ? stars : null;
}
