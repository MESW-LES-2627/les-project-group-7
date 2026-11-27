import {
  calculateAverageCostPoints,
  COST_POINTS,
  isPriceLevel,
  type PriceLevel,
} from "../reviews/rating";

export interface TripAverageStop {
  priceLevel?: string | null;
}

export interface TripAverageResult {
  averageCostPoints: number | null;
  knownPriceCount: number;
  unknownPriceCount: number;
  isOverBudget: boolean;
}

/**
 * Calculates the average cost of all stops in a trip.
 *
 * Unknown prices are excluded from the average.
 * If no stops have a known price, the average is null.
 *
 * A budget warning is only produced when both the average
 * and a valid budget level are available.
 */
export function calculateTripAverage(
  stops: readonly TripAverageStop[],
  budgetLevel?: PriceLevel | null
): TripAverageResult {
  let knownPriceCount = 0;
  let unknownPriceCount = 0;

  for (const stop of stops) {
    if (isPriceLevel(stop.priceLevel)) {
      knownPriceCount++;
    } else {
      unknownPriceCount++;
    }
  }

  const averageCostPoints = calculateAverageCostPoints(stops);

  const isOverBudget =
    averageCostPoints !== null &&
    budgetLevel != null &&
    isPriceLevel(budgetLevel) &&
    averageCostPoints > COST_POINTS[budgetLevel];

  return {
    averageCostPoints,
    knownPriceCount,
    unknownPriceCount,
    isOverBudget,
  };
}
