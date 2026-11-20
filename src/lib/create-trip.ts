import type { TripErrors, TripField } from "@/domain/trips/trip-validation";

/** What the form sends: the same fields as the server's trip input, all as text. */
export type NewTripForm = Record<TripField, string>;

export type CreateTripResult =
  { ok: true; id: string } | { ok: false; errors: TripErrors; message: string };

const GENERIC_MESSAGE = "Could not create the trip. Please try again.";

// `satisfies` makes the compiler fail when the server adds or removes a field, so this list cannot drift.
const FORM_FIELDS = Object.keys({
  name: true,
  cityId: true,
  startDate: true,
  endDate: true,
} satisfies Record<TripField, true>) as TripField[];

// Only these fields have a place on the form: an error for any other key would show nowhere.
function knownFieldErrors(errors: unknown): TripErrors {
  const result: TripErrors = {};
  for (const field of FORM_FIELDS) {
    const message = (errors as Record<string, unknown> | null)?.[field];
    if (typeof message === "string") result[field] = message;
  }
  return result;
}

/** Sends the new trip to POST /api/trips. The server is the only place that validates it (AC3 to AC5, AC7). */
export async function createTrip(form: NewTripForm): Promise<CreateTripResult> {
  try {
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => null);

    if (response.status === 201 && typeof body?.id === "string") {
      return { ok: true, id: body.id };
    }

    if (response.status === 400 && body?.errors) {
      return {
        ok: false,
        errors: knownFieldErrors(body.errors),
        message: typeof body.error === "string" ? body.error : GENERIC_MESSAGE,
      };
    }

    return {
      ok: false,
      errors: {},
      message:
        response.status === 401
          ? "Your session expired. Log in again."
          : GENERIC_MESSAGE,
    };
  } catch {
    return { ok: false, errors: {}, message: GENERIC_MESSAGE };
  }
}
