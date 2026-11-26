import type { PlaceCategory } from "@prisma/client";
import { ratingScore } from "@/domain/reviews/rating";
import { estimateWalkingMinutes, haversineDistanceKm } from "./geo";

/** Only the fields the ranking reads, so database places and test data both fit. */
export interface NearbyCandidate {
  id: string;
  category: PlaceCategory;
  averageRating: number | null;
  reviewCount: number;
  latitude: number;
  longitude: number;
}

export interface NearbyOptions {
  category: PlaceCategory | null;
  excludeIds: ReadonlySet<string>;
}

export interface NearbySuggestion<T extends NearbyCandidate> {
  place: T;
  distanceKm: number;
  walkingMinutes: number;
}

const NEAR_KM = 1;
const WIDER_KM = 2;
// Fewer than this many places within NEAR_KM and the search widens to WIDER_KM.
const MIN_NEAR_PLACES = 3;

/**
 * Best rated first by the weighted rating of ADR-008 (one review cannot outrank many), places
 * without a rating last, and the nearest first when the score is the same.
 */
function bestRatedThenNearest<T extends NearbyCandidate>(
  a: NearbySuggestion<T>,
  b: NearbySuggestion<T>
): number {
  const scoreA = ratingScore(a.place.averageRating, a.place.reviewCount);
  const scoreB = ratingScore(b.place.averageRating, b.place.reviewCount);

  if (scoreA === scoreB) return a.distanceKm - b.distanceKm;
  if (scoreA === null) return 1;
  if (scoreB === null) return -1;

  return scoreB - scoreA;
}

/**
 * The best places near a point (US-E5-01, #63): best rated first, each with its distance and walking
 * time.
 */
export function nearbyPlaces<T extends NearbyCandidate>(
  origin: { latitude: number; longitude: number },
  places: readonly T[],
  options: NearbyOptions
): {
  radiusKm: typeof NEAR_KM | typeof WIDER_KM;
  suggestions: NearbySuggestion<T>[];
} {
  const ranked = places
    .filter(
      (place) =>
        !options.excludeIds.has(place.id) &&
        (options.category === null || place.category === options.category)
    )
    .map((place) => {
      const distanceKm = haversineDistanceKm(
        origin.latitude,
        origin.longitude,
        place.latitude,
        place.longitude
      );

      return {
        place,
        distanceKm,
        walkingMinutes: estimateWalkingMinutes(distanceKm),
      };
    });

  const nearCount = ranked.filter((s) => s.distanceKm <= NEAR_KM).length;
  const radiusKm = nearCount < MIN_NEAR_PLACES ? WIDER_KM : NEAR_KM;
  const suggestions = ranked
    .filter((s) => s.distanceKm <= radiusKm)
    .sort(bestRatedThenNearest);

  return { radiusKm, suggestions };
}
