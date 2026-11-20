export type DeleteTripResult = { ok: true } | { ok: false; message: string };

/** Sends DELETE /api/trips/[id]. A 404 counts as done: the trip is already gone (for example, deleted in another tab). */
export async function deleteTrip(id: string): Promise<DeleteTripResult> {
  try {
    const response = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (response.status === 204 || response.status === 404) {
      return { ok: true };
    }

    const message =
      response.status === 401
        ? "Your session expired. Log in again."
        : "Could not delete the trip. Please try again.";

    return {
      ok: false,
      message,
    };
  } catch {
    return {
      ok: false,
      message: "Could not delete the trip. Please try again.",
    };
  }
}
