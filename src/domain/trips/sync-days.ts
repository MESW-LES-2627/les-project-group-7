import { buildTripDays, countTripDays, MAX_TRIP_DAYS } from "./trip-days";
import type { TripDay } from "./trip-days";

/**
 * Day synchronisation (US-E2-01, #54).
 *
 * When the dates of a trip change, its days have to follow: they always match the dates from start to
 * end, both included. This is a pure function: it works out what has to change and does not touch the
 * database. The Edit trip API (#55) applies the result.
 *
 * - Days are added or removed at the end, never in the middle, so the numbers stay 1, 2, 3 without gaps.
 * - A day that is kept keeps its number, and so do its stops: moving the start date moves the date of
 *   every day and nothing else.
 * - The dates are checked here too, because the new dates come from a person: an end date before the
 *   start date, a trip of more than 14 days or a date that does not exist change nothing.
 */

/** A day as it is stored: its number in the trip and its calendar date (midnight UTC). */
export interface StoredDay {
  dayNumber: number;
  date: Date;
}

export const SYNC_DAYS_ERRORS = {
  invalidDate: "Use real dates for the start and the end of the trip",
  endBeforeStart: "The end date cannot be before the start date",
  tooManyDays: `A trip can have ${MAX_TRIP_DAYS} days at most`,
} as const;

export type SyncDaysResult =
  | {
      ok: true;
      /** Days that stay but get a new date (the ones whose date is the same are not listed). */
      update: TripDay[];
      /** New empty days at the end, when the trip is longer. */
      add: TripDay[];
      /** Numbers of the days at the end that go away, with their stops, when the trip is shorter. */
      remove: number[];
    }
  | { ok: false; error: string };

function isCalendarDate(value: Date): boolean {
  return (
    value instanceof Date &&
    !Number.isNaN(value.getTime()) &&
    value.getTime() % (24 * 60 * 60 * 1000) === 0
  );
}

/**
 * Works out how the days of a trip change when its dates change.
 *
 * @param currentDays the days the trip has now
 * @param start the new start date (a calendar date, midnight UTC)
 * @param end the new end date (a calendar date, midnight UTC)
 * @returns `{ ok: true, update, add, remove }`, or `{ ok: false, error }` when the dates are not valid
 * and nothing should change
 */
export function syncDays(
  currentDays: StoredDay[],
  start: Date,
  end: Date
): SyncDaysResult {
  if (!isCalendarDate(start) || !isCalendarDate(end)) {
    return { ok: false, error: SYNC_DAYS_ERRORS.invalidDate };
  }

  const count = countTripDays(start, end);
  if (count === 0) {
    return { ok: false, error: SYNC_DAYS_ERRORS.endBeforeStart };
  }
  if (count > MAX_TRIP_DAYS) {
    return { ok: false, error: SYNC_DAYS_ERRORS.tooManyDays };
  }

  const wanted = buildTripDays(start, end);
  const current = new Map(currentDays.map((day) => [day.dayNumber, day]));

  const update = wanted.filter((day) => {
    const existing = current.get(day.dayNumber);
    return (
      existing !== undefined && existing.date.getTime() !== day.date.getTime()
    );
  });

  const add = wanted.filter((day) => !current.has(day.dayNumber));

  const remove = currentDays
    .map((day) => day.dayNumber)
    .filter((dayNumber) => dayNumber > count)
    .sort((a, b) => a - b);

  return { ok: true, update, add, remove };
}
