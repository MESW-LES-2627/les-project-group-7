import { countTripDays, MAX_TRIP_DAYS, parseDateOnly } from "./trip-days";

/**
 * Trip input validation rules (US-E1-01, #7). Pure function: checks the form of a new trip and gives
 * one message for each wrong or missing field, so the person sees everything to fix at once (AC7).
 *
 * A trip is a name, a city and dates. Nothing else is asked when it is created: the budget level and
 * the hour limits are optional settings of its itinerary (US-E4-01), and the types of place are an
 * input of the generator (US-E8-01).
 *
 * - The start date is today or later in the city of the trip, the end date is not before the start
 *   date, and a trip has at most 14 days (AC3 to AC5).
 */

export const TRIP_NAME_MAX_LENGTH = 100;

export interface TripInput {
  name: string;
  cityId: string;
  startDate: Date;
  endDate: Date;
}

export type TripField = keyof TripInput;

export type TripErrors = Partial<Record<TripField, string>>;

export type TripValidation =
  { ok: true; value: TripInput } | { ok: false; errors: TripErrors };

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Validates the raw body of a new trip.
 *
 * @param body the parsed JSON of the request
 * @param today today's date in the time zone of the trip's city, at midnight UTC: the start date
 * cannot be before it
 * @returns `{ ok: true, value }` with the trimmed name and real dates, or `{ ok: false, errors }` with
 * one message per field
 */
export function validateTripInput(body: unknown, today: Date): TripValidation {
  const input =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const errors: TripErrors = {};

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name === "") {
    errors.name = "Give the trip a name";
  } else if (name.length > TRIP_NAME_MAX_LENGTH) {
    errors.name = `The name can have ${TRIP_NAME_MAX_LENGTH} characters at most`;
  }

  const cityId = typeof input.cityId === "string" ? input.cityId.trim() : "";
  if (cityId === "") {
    errors.cityId = "Choose a city";
  }

  let startDate: Date | null = null;
  if (isBlank(input.startDate)) {
    errors.startDate = "Choose the start date";
  } else {
    startDate = parseDateOnly(input.startDate);
    if (startDate === null) {
      errors.startDate = "Use a real date like 2026-12-01 for the start date";
    } else if (startDate.getTime() < today.getTime()) {
      errors.startDate = "The trip cannot start in the past";
    }
  }

  let endDate: Date | null = null;
  if (isBlank(input.endDate)) {
    errors.endDate = "Choose the end date";
  } else {
    endDate = parseDateOnly(input.endDate);
    if (endDate === null) {
      errors.endDate = "Use a real date like 2026-12-03 for the end date";
    }
  }

  if (startDate && endDate && !errors.endDate) {
    const days = countTripDays(startDate, endDate);
    if (days === 0) {
      errors.endDate = "The end date cannot be before the start date";
    } else if (days > MAX_TRIP_DAYS) {
      errors.endDate = `A trip can have ${MAX_TRIP_DAYS} days at most`;
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    startDate === null ||
    endDate === null
  ) {
    return { ok: false, errors };
  }

  return { ok: true, value: { name, cityId, startDate, endDate } };
}
