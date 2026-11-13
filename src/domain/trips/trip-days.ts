/**
 * Days of a trip (US-E1-01, #7).
 *
 * A trip has one Day for each date from its start date to its end date, both included. All dates are
 * calendar dates (YYYY-MM-DD) of the city of the trip, held as midnight UTC only to store them: they
 * have no time zone, so a change of the clock (summer time) never adds or removes a day.
 */

/** The longest trip: 14 days (decided by the team, see mvp.md section 4). */
export const MAX_TRIP_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Reads a "YYYY-MM-DD" text and returns that date at midnight UTC. Returns null if the value is not a
 * text in that format or is not a real date (for example 2026-02-30).
 */
export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = DATE_ONLY.exec(value);
  if (!match) {
    return null;
  }

  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC rolls an impossible date over (30 February becomes 2 March), so compare it back.
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isRealDate ? date : null;
}

/**
 * Today's date in a time zone, as midnight UTC of that date. The dates of a trip are the dates in the
 * city of the trip, so "today" is today there, not where the person is: someone in Sydney can plan a
 * trip in Los Angeles, where it is still the day before.
 *
 * @param timeZone an IANA name such as "Europe/Lisbon". A name that is not known counts as UTC.
 */
export function startOfTodayInTimeZone(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
  }

  const part = (type: string) =>
    Number(parts.find((entry) => entry.type === type)?.value);

  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

/** The date as "YYYY-MM-DD". */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The number of days from `start` to `end`, both included: 1 for a trip that starts and ends on the
 * same date. It is 0 when the end is before the start.
 */
export function countTripDays(start: Date, end: Date): number {
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return Math.max(0, days);
}

export interface TripDay {
  dayNumber: number;
  date: Date;
}

/** The days of a trip: Day 1 is the start date, and the last day is the end date. */
export function buildTripDays(start: Date, end: Date): TripDay[] {
  const count = countTripDays(start, end);

  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    date: new Date(start.getTime() + index * DAY_MS),
  }));
}
