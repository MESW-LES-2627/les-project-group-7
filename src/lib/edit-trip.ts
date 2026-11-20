import type { TripErrors } from "@/domain/trips/trip-validation";

/** What the edit form sends: the same fields as the server's edit, all as text. */
export interface EditTripForm {
  name: string;
  startDate: string;
  endDate: string;
}

/** A day that would be removed, and how many stops go with it. */
export interface RemovedDay {
  dayNumber: number;
  date: string;
  stops: number;
}

export type EditTripResult =
  | { status: "saved" }
  | { status: "confirm"; days: RemovedDay[] }
  | { status: "error"; errors: TripErrors; message: string };

const GENERIC_MESSAGE = "Could not save the trip. Please try again.";

// `satisfies` makes the compiler fail when a field is added to the form, so this list cannot drift.
// Only these fields have a place on the form: an error for any other key would show nowhere.
const FORM_FIELDS = Object.keys({
  name: true,
  startDate: true,
  endDate: true,
} satisfies Record<keyof EditTripForm, true>) as (keyof EditTripForm)[];

function knownFieldErrors(errors: unknown): TripErrors {
  const result: TripErrors = {};
  for (const field of FORM_FIELDS) {
    const message = (errors as Record<string, unknown> | null)?.[field];
    if (typeof message === "string") result[field] = message;
  }
  return result;
}

function failure(message: string, errors: TripErrors = {}): EditTripResult {
  return { status: "error", errors, message };
}

/**
 * Sends the change to PATCH /api/trips/[id]. The server is the only place that validates it (AC4). A 409
 * is not a failure: it is the warning that days with stops would go, and the same call with
 * `confirmedStops` (the number of stops the warning listed) is the "yes" to it (AC2).
 */
export async function editTrip(
  id: string,
  form: EditTripForm,
  confirmedStops?: number
): Promise<EditTripResult> {
  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, confirmedStops }),
    });
    const body = await response.json().catch(() => null);

    if (response.status === 200) {
      return { status: "saved" };
    }

    if (response.status === 409 && Array.isArray(body?.removal?.days)) {
      return { status: "confirm", days: body.removal.days };
    }

    if (response.status === 400 && body?.errors) {
      return failure(
        typeof body.error === "string" ? body.error : GENERIC_MESSAGE,
        knownFieldErrors(body.errors)
      );
    }

    if (response.status === 401) {
      return failure("Your session expired. Log in again.");
    }

    if (response.status === 404) {
      return failure("This trip no longer exists.");
    }

    return failure(GENERIC_MESSAGE);
  } catch {
    return failure(GENERIC_MESSAGE);
  }
}
