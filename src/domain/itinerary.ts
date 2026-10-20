import { haversineDistanceKm, estimateWalkingMinutes } from "./geo";
import {
  type PriceLevel,
  calculateAverageCostPoints,
  COST_POINTS,
} from "./rating";

/**
 * Represents a place candidate to be scheduled in an itinerary.
 */
export interface PlaceCandidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  priceLevel?: PriceLevel | string | null;
  averageRating?: number | null;
  visitDurationMinutes?: number;
}

/**
 * Constraints defining the bounds of a trip for the itinerary generator.
 */
export interface TripConstraints {
  numberOfDays: number;
  maxHoursPerDay?: number; // Default: 8 hours (480 minutes)
  dailyBudgetLevel?: PriceLevel | null;
}

/**
 * A scheduled stop within an itinerary day.
 */
export interface ScheduledStop {
  place: PlaceCandidate;
  position: number;
  visitDurationMinutes: number;
  walkingMinutesFromPrevious: number;
}

/**
 * Plan for a single day of a trip.
 */
export interface DayPlan {
  dayNumber: number;
  stops: ScheduledStop[];
  totalDurationMinutes: number;
}

/**
 * Output of the itinerary generator algorithm.
 */
export interface ItineraryPlan {
  days: DayPlan[];
  excludedPlaces: PlaceCandidate[];
}

/**
 * Generates a day-by-day itinerary from candidate places using a deterministic nearest-neighbor heuristic.
 * 
 * Rules enforced:
 * 1. Time packing: Stops are packed into each day without exceeding `maxHoursPerDay` (visit duration + walking time).
 * 2. Budget constraint: If `dailyBudgetLevel` is defined, the day's average cost points must not exceed the target level.
 * 3. Nearest-neighbor selection: Subsequent stops on a day are chosen greedily by minimizing geographic distance.
 * 4. Overflow exclusion: Candidates that do not fit into any available day are collected in `excludedPlaces`.
 * 
 * @param constraints Constraints bounding the trip (number of days, daily hours, budget).
 * @param candidates List of places available to schedule.
 * @returns Fully scheduled itinerary days and any excluded candidate places.
 */
export function generateItinerary(
  constraints: TripConstraints,
  candidates: PlaceCandidate[]
): ItineraryPlan {
  const maxDailyMinutes = (constraints.maxHoursPerDay ?? 8) * 60;

  const targetBudgetPoints = constraints.dailyBudgetLevel
    ? COST_POINTS[constraints.dailyBudgetLevel]
    : null;

  const days: DayPlan[] = Array.from(
    { length: constraints.numberOfDays },
    (_, i) => ({
      dayNumber: i + 1,
      stops: [],
      totalDurationMinutes: 0,
    })
  );

  const remaining = [...candidates];
  const excludedPlaces: PlaceCandidate[] = [];

  for (const day of days) {
    let currentLat: number | null = null;
    let currentLon: number | null = null;

    while (remaining.length > 0) {
      // 1. Filter candidates that satisfy time and budget constraints
      const feasibleCandidates: {
        index: number;
        place: PlaceCandidate;
        duration: number;
        walkTime: number;
        distanceKm: number;
      }[] = [];

      for (let i = 0; i < remaining.length; i++) {
        const place = remaining[i];
        const duration = place.visitDurationMinutes ?? 60;

        // Daily budget constraint check
        if (targetBudgetPoints !== null) {
          const hypotheticalStops = [...day.stops.map((s) => s.place), place];
          const projectedAvgCost = calculateAverageCostPoints(hypotheticalStops);

          if (projectedAvgCost !== null && projectedAvgCost > targetBudgetPoints) {
            continue;
          }
        }

        // Travel time and total daily duration check
        let walkTime = 0;
        let distanceKm = 0;

        if (currentLat !== null && currentLon !== null) {
          distanceKm = haversineDistanceKm(
            currentLat,
            currentLon,
            place.latitude,
            place.longitude
          );
          walkTime = estimateWalkingMinutes(distanceKm);
        }

        const projectedTotalDuration =
          day.totalDurationMinutes + walkTime + duration;

        if (projectedTotalDuration <= maxDailyMinutes) {
          feasibleCandidates.push({
            index: i,
            place,
            duration,
            walkTime,
            distanceKm,
          });
        }
      }

      // If no candidate fits into this day, proceed to the next day
      if (feasibleCandidates.length === 0) {
        break;
      }

      // 2. Select best viable candidate:
      // If it's the first stop of the day, pick the first viable candidate.
      // If previous stops exist, pick the geographically closest candidate (nearest-neighbor).
      let chosen = feasibleCandidates[0];

      if (day.stops.length > 0) {
        for (let j = 1; j < feasibleCandidates.length; j++) {
          if (feasibleCandidates[j].distanceKm < chosen.distanceKm) {
            chosen = feasibleCandidates[j];
          }
        }
      }

      // 3. Schedule the chosen stop
      day.stops.push({
        place: chosen.place,
        position: day.stops.length + 1,
        visitDurationMinutes: chosen.duration,
        walkingMinutesFromPrevious: chosen.walkTime,
      });

      day.totalDurationMinutes += chosen.walkTime + chosen.duration;

      currentLat = chosen.place.latitude;
      currentLon = chosen.place.longitude;

      // Remove chosen candidate from remaining list
      remaining.splice(chosen.index, 1);
    }
  }

  excludedPlaces.push(...remaining);

  return {
    days,
    excludedPlaces,
  };
}
