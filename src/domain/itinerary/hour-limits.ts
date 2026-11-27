import { parseVisitTime } from "./visit-time";

/**
 * The hour-limits check of a stop (US-E6-01, #146): whether a visit time is outside the hour limits
 * the planner set on the itinerary (`dayStart`, `dayEnd`, US-E4-01). It only warns, it never blocks.
 *
 * - Each limit counts on its own: a time before `dayStart` or after `dayEnd` is outside. A limit that
 *   is not set never warns (AC8).
 * - A time right on a limit is inside: the limits are the first and the last minute of the planner's
 *   day ("from 09:00 to 20:00").
 * - What cannot be read never warns: no visit time, or a time or a limit that is not "HH:mm" (a limit
 *   that cannot be read counts as not set).
 */

/** A time "HH:mm", or null when it is empty or cannot be read. */
function readTime(value: string | null | undefined): string | null {
  const parsed = parseVisitTime(value);
  return parsed.ok ? parsed.value : null;
}

/**
 * Whether a visit time is outside the hour limits of the itinerary.
 *
 * @param dayStart the start of the day of the itinerary "HH:mm", `null` when not set
 * @param dayEnd the end of the day of the itinerary "HH:mm", `null` when not set
 * @param time the visit time of the stop "HH:mm", `null` when the stop has no time
 */
export function isOutsideHourLimits(
  dayStart: string | null | undefined,
  dayEnd: string | null | undefined,
  time: string | null | undefined
): boolean {
  const visit = readTime(time);
  if (visit === null) return false;

  const start = readTime(dayStart);
  const end = readTime(dayEnd);

  // "HH:mm" with two digits each compares as text in the order of the day
  return (start !== null && visit < start) || (end !== null && visit > end);
}
