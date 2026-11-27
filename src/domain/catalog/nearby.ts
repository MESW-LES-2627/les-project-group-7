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
  /** The weighted rating of ADR-008 that ranks the place, `null` when it is not rated. */
  score: number | null;
}

type RadiusKm = 1 | 2;

const NEAR_KM: RadiusKm = 1;
const WIDER_KM: RadiusKm = 2;
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
  if (a.score === b.score) return a.distanceKm - b.distanceKm;
  if (a.score === null) return 1;
  if (b.score === null) return -1;

  return b.score - a.score;
}

/**
 * The best places near a point (US-E5-01, #63): best rated first, each with its distance and walking
 * time.
 */
export function nearbyPlaces<T extends NearbyCandidate>(
  origin: { latitude: number; longitude: number },
  places: readonly T[],
  options: NearbyOptions
): { radiusKm: RadiusKm; suggestions: NearbySuggestion<T>[] } {
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
        score: ratingScore(place.averageRating, place.reviewCount),
      };
    });

  const nearCount = ranked.filter((s) => s.distanceKm <= NEAR_KM).length;
  const radiusKm = nearCount < MIN_NEAR_PLACES ? WIDER_KM : NEAR_KM;
  const suggestions = ranked
    .filter((s) => s.distanceKm <= radiusKm)
    .sort(bestRatedThenNearest);

  return { radiusKm, suggestions };
}

/** A distance for the eye: meters under 1 km ("334 m"), one decimal of a kilometer from there ("1.2 km"). */
export function formatDistance(distanceKm: number): string {
  const meters = Math.round(distanceKm * 1000);

  if (meters < 1000) return `${meters} m`;

  return `${(Math.round(meters / 100) / 10).toFixed(1)} km`;
}
