import { parseVisitTime } from "./visit-time";

/**
 * The settings of an itinerary (US-E4-01, #144): a budget level and two hour limits, `dayStart` and
 * `dayEnd`. All three are optional and soft: they never block a stop, they only produce warnings
 * (US-E6-01, US-E6-02). The input of a generation (US-E8-01) uses the same rules for the hour limits
 * and the budget level, with the budget level required there.
 *
 * - The budget level is `€`, `€€` or `€€€`. `FREE` is a price level of a place, not a budget level.
 * - An hour limit is a time of the day "HH:mm", from 00:00 to 23:59 (the same rule as a visit time).
 * - When both hour limits are set, the start is before the end. Equal is refused: it leaves no time.
 * - Empty (`null` or `""`) means no setting, and saving it clears what was saved before.
 */

export const BUDGET_LEVELS = ["€", "€€", "€€€"] as const;

export type BudgetLevel = (typeof BUDGET_LEVELS)[number];

export interface ItinerarySettings {
  budgetLevel: BudgetLevel | null;
  dayStart: string | null;
  dayEnd: string | null;
}

export type SettingsField = keyof ItinerarySettings;

export const SETTINGS_FIELDS: readonly SettingsField[] = [
  "budgetLevel",
  "dayStart",
  "dayEnd",
];

export type SettingsValidation =
  | { ok: true; value: ItinerarySettings }
  | { ok: false; errors: Partial<Record<SettingsField, string>> };

export const BUDGET_LEVEL_ERROR =
  "Choose a budget level of €, €€ or €€€, or leave it empty";

export const HOUR_ORDER_ERROR = "The end of the day has to be after its start";

export const MISSING_SETTING_ERROR =
  "Send this setting too (null to leave it empty)";

export const NOT_AN_OBJECT_ERROR =
  "Send the settings as an object with budgetLevel, dayStart and dayEnd";

/** Whether a value is one of the three budget levels (`FREE` is not one). */
export function isBudgetLevel(value: unknown): value is BudgetLevel {
  return (
    typeof value === "string" &&
    (BUDGET_LEVELS as readonly string[]).includes(value)
  );
}

function isEmpty(value: unknown): boolean {
  return value === null || value === "";
}

/**
 * Checks the three settings sent together. All three keys have to be in the body, so that a
 * setting is never cleared because it was forgotten; `null` or `""` leaves one empty.
 *
 * @returns the settings as they are saved, or one error message for each wrong setting
 */
export function validateItinerarySettings(body: unknown): SettingsValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      errors: {
        budgetLevel: NOT_AN_OBJECT_ERROR,
        dayStart: NOT_AN_OBJECT_ERROR,
        dayEnd: NOT_AN_OBJECT_ERROR,
      },
    };
  }

  const input = body as Record<string, unknown>;
  const errors: Partial<Record<SettingsField, string>> = {};

  for (const field of SETTINGS_FIELDS) {
    if (!Object.hasOwn(input, field)) {
      errors[field] = MISSING_SETTING_ERROR;
    }
  }

  let budgetLevel: BudgetLevel | null = null;
  if (!errors.budgetLevel) {
    const raw = input.budgetLevel;
    if (isBudgetLevel(raw)) {
      budgetLevel = raw;
    } else if (!isEmpty(raw)) {
      errors.budgetLevel = BUDGET_LEVEL_ERROR;
    }
  }

  const times: Pick<ItinerarySettings, "dayStart" | "dayEnd"> = {
    dayStart: null,
    dayEnd: null,
  };
  for (const field of ["dayStart", "dayEnd"] as const) {
    if (errors[field]) continue;
    const parsed = parseVisitTime(input[field]);
    if (parsed.ok) {
      times[field] = parsed.value;
    } else {
      errors[field] = parsed.error;
    }
  }

  // "HH:mm" with two digits each compares as text in the order of the day
  if (
    !errors.dayStart &&
    !errors.dayEnd &&
    times.dayStart !== null &&
    times.dayEnd !== null &&
    times.dayStart >= times.dayEnd
  ) {
    errors.dayEnd = HOUR_ORDER_ERROR;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { budgetLevel, ...times } };
}
