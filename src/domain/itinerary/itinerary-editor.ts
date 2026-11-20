import {
  savedSections,
  type SavedPlace,
} from "@/domain/saved-places/saved-places";
import { moveStop, type StopRefusal } from "./stop-order";
import type { toStopResponse } from "./stop-response";

export type EditorStop = ReturnType<typeof toStopResponse>;

export interface EditorDay {
  id: string;
  dayNumber: number;
  date: string;
}

export function stopsByDay(
  days: readonly EditorDay[],
  stops: readonly EditorStop[]
): Map<string, EditorStop[]> {
  const byDay = new Map<string, EditorStop[]>(days.map((day) => [day.id, []]));

  for (const stop of stops) {
    byDay.get(stop.dayId)?.push(stop);
  }

  for (const dayStops of byDay.values()) {
    dayStops.sort((a, b) => a.position - b.position);
  }

  return byDay;
}

export type StopMove = "up" | "down" | "previous-day" | "next-day";

/** The body of a PATCH that moves a stop. */
export type MoveBody = { position: number } | { dayId: string };

export type MoveOption =
  | { available: true; body: MoveBody }
  | { available: false; reason: string | null };

export function moveOption(
  days: readonly EditorDay[],
  stops: readonly EditorStop[],
  stopId: string,
  move: StopMove
): MoveOption {
  const stop = stops.find((item) => item.id === stopId);
  if (!stop) {
    return { available: false, reason: null };
  }

  const ordered = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const dayIndex = ordered.findIndex((day) => day.id === stop.dayId);
  const dayLength = stops.filter((item) => item.dayId === stop.dayId).length;

  let body: MoveBody;
  let toDayId = stop.dayId;
  let toPosition: number | undefined;

  switch (move) {
    case "up":
      if (stop.position <= 1) return { available: false, reason: null };
      toPosition = stop.position - 1;
      body = { position: toPosition };
      break;
    case "down":
      if (stop.position >= dayLength) return { available: false, reason: null };
      toPosition = stop.position + 1;
      body = { position: toPosition };
      break;
    case "previous-day":
    case "next-day": {
      const target = ordered[dayIndex + (move === "next-day" ? 1 : -1)];
      if (dayIndex === -1 || !target) return { available: false, reason: null };
      toDayId = target.id;
      body = { dayId: toDayId };
      break;
    }
  }

  const decision = moveStop(
    stops,
    { cityId: "", dayIds: ordered.map((day) => day.id) },
    stopId,
    toDayId,
    toPosition
  );

  if (!decision.ok) {
    return { available: false, reason: decision.error };
  }

  return { available: true, body };
}

export interface AddablePlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  category?: string | null;
  priceLevel?: string | null;
}

export interface AddStopBody {
  dayId: string;
  placeId: string;
  visitTime?: string;
  place?: {
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
    category?: string;
    priceLevel?: string;
  };
}

export function addStopBody(
  dayId: string,
  place: AddablePlace,
  visitTime: string | null
): AddStopBody {
  const body: AddStopBody = { dayId, placeId: place.id };

  if (visitTime) {
    body.visitTime = visitTime;
  }

  if (place.id.startsWith("osm-")) {
    body.place = {
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      ...(place.address ? { address: place.address } : {}),
      ...(place.category ? { category: place.category } : {}),
      ...(place.priceLevel ? { priceLevel: place.priceLevel } : {}),
    };
  }

  return body;
}

export const ALREADY_PLANNED_MESSAGE =
  "This place is already planned in this trip.";
export const CONCURRENT_CHANGE_MESSAGE =
  "The itinerary was changed at the same time. Nothing was saved, try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session expired. Log in again.";
export const GENERIC_STOP_MESSAGE =
  "Could not save the change. Please try again.";

export interface StopRequestError {
  message: string;
  reason: StopRefusal | null;
  reload: boolean;
}

export function stopRequestError(
  status: number,
  body: unknown
): StopRequestError {
  const data =
    typeof body === "object" && body !== null
      ? (body as {
          error?: unknown;
          reason?: unknown;
          errors?: { visitTime?: unknown };
        })
      : {};
  const reason =
    typeof data.reason === "string" ? (data.reason as StopRefusal) : null;
  const apiMessage = typeof data.error === "string" ? data.error : null;

  if (status === 401) {
    return { message: SESSION_EXPIRED_MESSAGE, reason: null, reload: false };
  }

  if (status === 409) {
    return reason === "ALREADY_PLANNED"
      ? { message: ALREADY_PLANNED_MESSAGE, reason, reload: false }
      : { message: CONCURRENT_CHANGE_MESSAGE, reason: null, reload: true };
  }

  if (status === 400) {
    const timeMessage =
      typeof data.errors?.visitTime === "string" ? data.errors.visitTime : null;
    return {
      message: timeMessage ?? apiMessage ?? GENERIC_STOP_MESSAGE,
      reason,
      reload: false,
    };
  }

  if (status === 404) {
    return {
      message: apiMessage
        ? `${apiMessage}. The itinerary was read again.`
        : "This trip or stop no longer exists.",
      reason,
      reload: true,
    };
  }

  return { message: GENERIC_STOP_MESSAGE, reason, reload: false };
}

// The saved places the planner can add: the ones of the city of the trip (the API refuses the others), in
// the sections of My places. The rest is only counted, so the panel can say why they are not listed.
export function plannerSavedPlaces(
  saved: readonly SavedPlace[],
  cityPlaceIds: ReadonlySet<string>
) {
  const inCity = saved.filter((entry) => cityPlaceIds.has(entry.place.id));

  return {
    sections: savedSections(inCity),
    elsewhere: new Set(
      saved
        .filter((entry) => !cityPlaceIds.has(entry.place.id))
        .map((entry) => entry.place.id)
    ).size,
  };
}
