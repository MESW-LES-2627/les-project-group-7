import { countTripDays, MAX_TRIP_DAYS, parseDateOnly } from "./trip-days";
import { TRIP_NAME_MAX_LENGTH } from "./trip-validation";
import type { TripErrors } from "./trip-validation";

/**
 * Edit trip input rules (US-E2-01, #55). Pure function: checks the body of a change of a trip and
 * gives one message for each wrong field, like the creation of a trip does.
 *
 * - Only the name and the dates change: the city stays, so the time zone of the days stays too.
 * - The start date is compared with today only when the person changes it, so a trip that has already
 *   started can be renamed or made longer.
 * - `confirmedStops` is the "yes" to the warning that days with stops will be removed: the number of
 *   stops the person was told would go. The server accepts it only when it is still that number.
 */

export interface TripEdit {
  name: string;
  startDate: Date;
  endDate: Date;
  confirmedStops: number | null;
}

export type TripEditValidation =
  { ok: true; value: TripEdit } | { ok: false; errors: TripErrors };

/**
 * @param body the parsed JSON of the request
 * @param current the dates the trip has now
 * @param today today's date in the time zone of the trip's city, at midnight UTC
 */
export function validateTripEdit(
  body: unknown,
  current: { startDate: Date; endDate: Date },
  today: Date
): TripEditValidation {
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

  const startDate = parseDateOnly(input.startDate);
  if (input.startDate === undefined || input.startDate === "") {
    errors.startDate = "Choose the start date";
  } else if (startDate === null) {
    errors.startDate = "Use a real date like 2026-12-01 for the start date";
  } else if (
    startDate.getTime() !== current.startDate.getTime() &&
    startDate.getTime() < today.getTime()
  ) {
    errors.startDate = "The trip cannot start in the past";
  }

  const endDate = parseDateOnly(input.endDate);
  if (input.endDate === undefined || input.endDate === "") {
    errors.endDate = "Choose the end date";
  } else if (endDate === null) {
    errors.endDate = "Use a real date like 2026-12-03 for the end date";
  }

  if (startDate && endDate && !errors.endDate) {
    const days = countTripDays(startDate, endDate);
    if (days === 0) {
      errors.endDate = "The end date cannot be before the start date";
    } else if (days > MAX_TRIP_DAYS) {
      errors.endDate = `A trip can have ${MAX_TRIP_DAYS} days at most`;
    }
  }

  if (Object.keys(errors).length > 0 || !startDate || !endDate) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      name,
      startDate,
      endDate,
      confirmedStops:
        Number.isInteger(input.confirmedStops) &&
        (input.confirmedStops as number) >= 0
          ? (input.confirmedStops as number)
          : null,
    },
  };
}
