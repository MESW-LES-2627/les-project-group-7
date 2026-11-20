/**
 * The visit time of a stop (US-E4-01, #60).
 *
 * A visit time is a time of the day written "HH:mm", from 00:00 to 23:59. That is the only rule: the
 * hour limits of the itinerary are the person's own settings, they only warn (US-E6-01) and they
 * never block, so they are not read here. 22:30 and 00:00 are accepted with or without limits.
 */

const VISIT_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const VISIT_TIME_ERROR =
  "Use a time of the day like 09:30 (00:00 to 23:59)";

export type VisitTimeResult =
  { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Reads a visit time that is optional: `null` or an empty value means no time. Anything else has to
 * be a text "HH:mm".
 *
 * @returns the time as it is saved ("HH:mm"), `null` for no time, or an error message
 */
export function parseVisitTime(value: unknown): VisitTimeResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "string" || !VISIT_TIME.test(value)) {
    return { ok: false, error: VISIT_TIME_ERROR };
  }

  return { ok: true, value };
}
