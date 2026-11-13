import { formatDateOnly } from "./trip-days";

/**
 * How a trip is sent to the browser: dates as "YYYY-MM-DD", the days from Day 1 on, and its itinerary
 * with the optional settings (empty when the person did not set them). The trip endpoints and the trip
 * pages all use this one function.
 */

export interface TripRecord {
  id: string;
  name: string;
  cityId: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  days: { id: string; dayNumber: number; date: Date }[];
  itinerary: {
    id: string;
    mode: string;
    budgetLevel: string | null;
    dayStart: string | null;
    dayEnd: string | null;
  };
}

export function toTripResponse(trip: TripRecord) {
  return {
    id: trip.id,
    name: trip.name,
    cityId: trip.cityId,
    startDate: formatDateOnly(trip.startDate),
    endDate: formatDateOnly(trip.endDate),
    createdAt: trip.createdAt.toISOString(),
    days: [...trip.days]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: formatDateOnly(day.date),
      })),
    itinerary: {
      id: trip.itinerary.id,
      mode: trip.itinerary.mode,
      budgetLevel: trip.itinerary.budgetLevel,
      dayStart: trip.itinerary.dayStart,
      dayEnd: trip.itinerary.dayEnd,
    },
  };
}
