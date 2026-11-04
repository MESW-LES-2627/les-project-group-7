import type { PlaceCategory } from "@prisma/client";
import { ratingScore, type PriceLevel } from "@/domain/reviews/rating";

/**
 * The filters of a city's place list (US-B3-02). `null` means the filter is not set, so
 * NO_PLACE_FILTERS is also how the filters are cleared.
 */
export interface PlaceFilters {
  category: PlaceCategory | null;
  priceLevel: PriceLevel | null;
  minRating: number | null;
}

export const NO_PLACE_FILTERS: PlaceFilters = {
  category: null,
  priceLevel: null,
  minRating: null,
};

// Only the fields the filters read, so database places, OpenStreetMap places and test data all fit.
interface FilterablePlace {
  category: PlaceCategory;
  priceLevel?: string | null;
  averageRating: number | null;
}

/**
 * Keeps the places that match every filter that is set (AC4: the filters combine with AND).
 * A filter set to null is off. <T> only means "you get back the same kind of place you gave".
 */
export function filterPlaces<T extends FilterablePlace>(
  places: readonly T[],
  filters: PlaceFilters
): T[] {
  return places.filter((place) => {
    // AC1: type
    if (filters.category !== null && place.category !== filters.category) {
      return false;
    }

    // AC2: price. A place without a price level is never equal to a chosen level.
    if (
      filters.priceLevel !== null &&
      place.priceLevel !== filters.priceLevel
    ) {
      return false;
    }

    // AC3: minimum rating, inclusive, by the plain average. No reviews means no average.
    if (
      filters.minRating !== null &&
      (place.averageRating === null || place.averageRating < filters.minRating)
    ) {
      return false;
    }

    return true;
  });
}

interface RankablePlace {
  name: string;
  averageRating: number | null;
  reviewCount?: number | null;
}

/**
 * AC5: best rated first, places without reviews last; on a tie, more reviews first, then by name
 * (business rule), so the order is always the same for the same places.
 * Uses the Bayesian rating score (ADR-008, US-B6-01) so that one 5-star review cannot outrank
 * many reviews averaging 4.8.
 */
export function sortPlacesByRating<T extends RankablePlace>(
  places: readonly T[]
): T[] {
  // Copy first: Array.sort changes the array in place, and the input may be React state.
  return [...places].sort(
    (a, b) =>
      // Each line is 0 on a tie, and `||` then moves on to the next criterion.
      // No reviews counts as -1, below any real rating score (1 to 5), so those places go last.
      (ratingScore(b.averageRating, b.reviewCount) ?? -1) -
        (ratingScore(a.averageRating, a.reviewCount) ?? -1) ||
      (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
      a.name.localeCompare(b.name)
  );
}
