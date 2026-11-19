import {
  GENERIC_STOP_MESSAGE,
  stopRequestError,
  type AddStopBody,
  type EditorStop,
  type MoveBody,
  type StopRequestError,
} from "@/domain/itinerary/itinerary-editor";

export type StopsResult =
  { ok: true; stops: EditorStop[] } | ({ ok: false } & StopRequestError);

export type UpdateStopBody = MoveBody | { visitTime: string | null };

const NETWORK_FAILURE: StopsResult = {
  ok: false,
  message: GENERIC_STOP_MESSAGE,
  reason: null,
  reload: false,
};

function stopsUrl(tripId: string, stopId?: string): string {
  const base = `/api/trips/${encodeURIComponent(tripId)}/stops`;
  return stopId ? `${base}/${encodeURIComponent(stopId)}` : base;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(url: string, init?: RequestInit): Promise<StopsResult> {
  try {
    const response = await fetch(url, init);
    const data = await readBody(response);

    if (response.ok) {
      const stops = (data as { stops?: unknown } | null)?.stops;
      return Array.isArray(stops)
        ? { ok: true, stops: stops as EditorStop[] }
        : NETWORK_FAILURE;
    }

    return { ok: false, ...stopRequestError(response.status, data) };
  } catch {
    return NETWORK_FAILURE;
  }
}

function send(
  url: string,
  method: "POST" | "PATCH",
  body: unknown
): Promise<StopsResult> {
  return request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** GET: the stops of the trip, to read the itinerary again after a change made elsewhere. */
export function fetchStops(tripId: string): Promise<StopsResult> {
  return request(stopsUrl(tripId));
}

/** POST: adds a place to a day */
export function addStop(
  tripId: string,
  body: AddStopBody
): Promise<StopsResult> {
  return send(stopsUrl(tripId), "POST", body);
}

/** PATCH: moves a stop or sets its visit time */
export function updateStop(
  tripId: string,
  stopId: string,
  body: UpdateStopBody
): Promise<StopsResult> {
  return send(stopsUrl(tripId, stopId), "PATCH", body);
}

export type RemoveStopResult =
  { ok: true } | ({ ok: false } & StopRequestError);

/**
 * DELETE: removes a stop. A 404 for a stop that is already gone (removed in another tab)
 * counts as done; the page reads the itinerary again.
 */
export async function removeStop(
  tripId: string,
  stopId: string
): Promise<RemoveStopResult> {
  try {
    const response = await fetch(stopsUrl(tripId, stopId), {
      method: "DELETE",
    });

    if (response.status === 204) {
      return { ok: true };
    }

    const data = await readBody(response);
    if (
      response.status === 404 &&
      (data as { reason?: unknown } | null)?.reason === "STOP_NOT_FOUND"
    ) {
      return { ok: true };
    }

    return { ok: false, ...stopRequestError(response.status, data) };
  } catch {
    return {
      ok: false,
      message: GENERIC_STOP_MESSAGE,
      reason: null,
      reload: false,
    };
  }
}
