/**
 * Stop ordering rules (US-E4-01, #59 and #60).
 *
 * The order of the stops of a day is the person's: a stop is added at the end and can be moved anywhere.
 * One rule protects the times: the stops that have a visit time stay in the order of their times,
 * whatever stops without a time are between them. So `Museum 10:00`, `a café with no time`, `Castle
 * 14:00` is a good day, and a stop set to 12:00 goes after the museum. A stop without a time can be
 * put anywhere, and a stop with a time cannot be moved past another stop with an earlier or later time
 * (its time has to change first).
 */

/** A stop as the rules need it. `visitTime` ("HH:mm") is missing or null for a stop without a time. */
export interface PlannedStop {
  id: string;
  dayId: string;
  placeId: string;
  position: number;
  visitTime?: string | null;
}

/** Where a stop must be saved */
export interface StopPlacement {
  id: string;
  dayId: string;
  position: number;
}

/** Why a change was refused. The API can choose its status code from it. */
export type StopRefusal =
  | "STOP_NOT_FOUND"
  | "UNKNOWN_DAY"
  | "INVALID_POSITION"
  | "ALREADY_PLANNED"
  | "OTHER_CITY"
  | "TIME_ORDER";

export type StopRuleFailure = {
  ok: false;
  reason: StopRefusal;
  error: string;
};

/**
 * The result of a move or a removal: only the stops whose day or position changes, so nothing else
 * has to be written. It is empty when nothing changes.
 */
export type StopChanges =
  { ok: true; changes: StopPlacement[] } | StopRuleFailure;

/** The result of adding a stop */
export type NewStopPlacement =
  { ok: true; position: number; changes: StopPlacement[] } | StopRuleFailure;

/** The trip as the rules need it */
export interface TripLayout {
  cityId: string;
  dayIds: readonly string[];
}

/** Stands for the stop that is being added, which has no id yet. */
const NEW_STOP = "\u0000new-stop";

function refuse(reason: StopRefusal, error: string): StopRuleFailure {
  return { ok: false, reason, error };
}

function stopsOfDay(
  stops: readonly PlannedStop[],
  dayId: string
): PlannedStop[] {
  return stops
    .filter((stop) => stop.dayId === dayId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function numberDay(
  orderedIds: readonly string[],
  dayId: string
): StopPlacement[] {
  return orderedIds.map((id, index) => ({ id, dayId, position: index + 1 }));
}

function onlyChanged(
  stops: readonly PlannedStop[],
  placements: readonly StopPlacement[]
): StopPlacement[] {
  const current = new Map(stops.map((stop) => [stop.id, stop]));

  return placements.filter((placement) => {
    const stop = current.get(placement.id);
    return (
      !stop ||
      stop.dayId !== placement.dayId ||
      stop.position !== placement.position
    );
  });
}

type Timed = { visitTime?: string | null };

/** The first two stops with a time that are in the wrong order (`time` comes after `after`), or null. */
function firstTimeConflict(
  day: readonly Timed[]
): { time: string; after: string } | null {
  let previous: string | null = null;

  for (const stop of day) {
    const time = stop.visitTime ?? null;
    if (time === null) {
      continue;
    }
    if (previous !== null && time < previous) {
      return { time, after: previous };
    }
    previous = time;
  }

  return null;
}

function timeOrderRefusal(conflict: { time: string; after: string }) {
  return refuse(
    "TIME_ORDER",
    `The stops with a time keep the order of their times: ${conflict.time} cannot come after ${conflict.after}. Change the time first, or move a stop that has no time`
  );
}

/**
 * Where a stop with a time goes in a day (the day without that stop): right after the last stop with
 * the same or an earlier time. If every stop with a time is later, right before the first of them. If
 * no stop has a time, at the end.
 *
 * @returns the index in `day` to insert at, 0 to `day.length`
 */
function insertionIndex(day: readonly Timed[], time: string): number {
  let lastNotLater = -1;
  let firstTimed = -1;

  day.forEach((stop, index) => {
    const stopTime = stop.visitTime ?? null;
    if (stopTime === null) {
      return;
    }
    if (firstTimed === -1) {
      firstTimed = index;
    }
    if (stopTime <= time) {
      lastNotLater = index;
    }
  });

  if (lastNotLater !== -1) {
    return lastNotLater + 1;
  }
  return firstTimed !== -1 ? firstTimed : day.length;
}

/**
 * Checks a new stop and gives its position: the end of the day, or, for a stop with a time, its place
 * among the stops that have a time (the stops after it move down).
 *
 * @param stops every stop of the trip
 * @param place the place to add and the city it is in
 * @param dayId the day to add it to
 * @param visitTime its visit time ("HH:mm"), or null for none
 * @returns the position for the new stop and the stops that change position, or why it cannot be added
 */
export function placeNewStop(
  stops: readonly PlannedStop[],
  trip: TripLayout,
  place: { id: string; cityId: string },
  dayId: string,
  visitTime: string | null = null
): NewStopPlacement {
  if (!trip.dayIds.includes(dayId)) {
    return refuse("UNKNOWN_DAY", "This day is not part of the trip");
  }

  if (place.cityId !== trip.cityId) {
    return refuse("OTHER_CITY", "This place is not in the city of the trip");
  }

  if (stops.some((stop) => stop.placeId === place.id)) {
    return refuse(
      "ALREADY_PLANNED",
      "This place is already planned in this trip"
    );
  }

  const day = stopsOfDay(stops, dayId);
  const at = visitTime === null ? day.length : insertionIndex(day, visitTime);

  const ids = day.map((stop) => stop.id);
  const order = [...ids.slice(0, at), NEW_STOP, ...ids.slice(at)];
  const placements = numberDay(order, dayId).filter(
    (placement) => placement.id !== NEW_STOP
  );

  return {
    ok: true,
    position: at + 1,
    changes: onlyChanged(stops, placements),
  };
}

/**
 * Moves a stop to a position of the same day or of another day of the trip (AC2). The stops after
 * it in its old day move up, and the stops from the new position on in the new day move down.
 *
 * A stop with a time cannot be put out of the order of the times: it is refused (`TIME_ORDER`) if a
 * stop with a later time would come before it, or one with an earlier time after it. A stop without a
 * time can go anywhere.
 *
 * @param stops every stop of the trip
 * @param stopId the stop to move
 * @param toDayId the day it goes to, which can be the day it is on
 * @param toPosition its new position. Without one the stop stays where it is in its own day, and in
 * another day it goes to the end, or, for a stop with a time, to its place among the times.
 */
export function moveStop(
  stops: readonly PlannedStop[],
  trip: TripLayout,
  stopId: string,
  toDayId: string,
  toPosition?: number
): StopChanges {
  const stop = stops.find((item) => item.id === stopId);
  if (!stop) {
    return refuse("STOP_NOT_FOUND", "This stop is not in the itinerary");
  }

  if (!trip.dayIds.includes(toDayId)) {
    return refuse("UNKNOWN_DAY", "This day is not part of the trip");
  }

  const time = stop.visitTime ?? null;
  const sameDay = toDayId === stop.dayId;

  const fromDay = stopsOfDay(stops, stop.dayId)
    .map((item) => item.id)
    .filter((id) => id !== stopId);
  const toDayStops = sameDay
    ? stopsOfDay(stops, stop.dayId).filter((item) => item.id !== stopId)
    : stopsOfDay(stops, toDayId);
  const toDay = toDayStops.map((item) => item.id);

  let position = toPosition;
  if (position === undefined) {
    if (sameDay) {
      return { ok: true, changes: [] };
    }
    position =
      time === null ? toDay.length + 1 : insertionIndex(toDayStops, time) + 1;
  }

  const lastPosition = toDay.length + 1;
  if (!Number.isInteger(position) || position < 1 || position > lastPosition) {
    return refuse(
      "INVALID_POSITION",
      `Choose a position from 1 to ${lastPosition}`
    );
  }

  const newToDay = [
    ...toDay.slice(0, position - 1),
    stopId,
    ...toDay.slice(position - 1),
  ];

  if (time !== null) {
    const byId = new Map(stops.map((item) => [item.id, item]));
    const conflict = firstTimeConflict(
      newToDay.map((id) => (id === stopId ? stop : byId.get(id)) ?? {})
    );
    if (conflict) {
      return timeOrderRefusal(conflict);
    }
  }

  const placements = sameDay
    ? numberDay(newToDay, toDayId)
    : [...numberDay(fromDay, stop.dayId), ...numberDay(newToDay, toDayId)];

  return { ok: true, changes: onlyChanged(stops, placements) };
}

/**
 * The stops that change position when a stop gets a visit time (the caller saves the time itself).
 * The stop stays where it is if the stops with a time are still in the order of their times. If not,
 * it goes to its place among them: right after the last stop with the same or an earlier time. Clearing
 * the time (`null`) never moves anything.
 *
 * @param stops every stop of the trip, with the times they have now
 * @param stopId the stop that gets the time
 * @param visitTime the new time ("HH:mm") or null for none
 */
export function setStopTime(
  stops: readonly PlannedStop[],
  stopId: string,
  visitTime: string | null
): StopChanges {
  const stop = stops.find((item) => item.id === stopId);
  if (!stop) {
    return refuse("STOP_NOT_FOUND", "This stop is not in the itinerary");
  }

  if (visitTime === null) {
    return { ok: true, changes: [] };
  }

  const day = stopsOfDay(stops, stop.dayId).map((item) =>
    item.id === stopId ? { ...item, visitTime } : item
  );
  if (firstTimeConflict(day) === null) {
    return { ok: true, changes: [] };
  }

  const others = day.filter((item) => item.id !== stopId);
  const at = insertionIndex(others, visitTime);
  const order = [
    ...others.slice(0, at).map((item) => item.id),
    stopId,
    ...others.slice(at).map((item) => item.id),
  ];

  return {
    ok: true,
    changes: onlyChanged(stops, numberDay(order, stop.dayId)),
  };
}

/**
 * Removes a stop (AC4). The caller deletes it; `changes` are the stops after it in its day, which
 * move up by one so the positions stay 1, 2, 3 and keep their order.
 */
export function removeStop(
  stops: readonly PlannedStop[],
  stopId: string
): StopChanges {
  const stop = stops.find((item) => item.id === stopId);
  if (!stop) {
    return refuse("STOP_NOT_FOUND", "This stop is not in the itinerary");
  }

  const remaining = stopsOfDay(stops, stop.dayId)
    .map((item) => item.id)
    .filter((id) => id !== stopId);

  return {
    ok: true,
    changes: onlyChanged(stops, numberDay(remaining, stop.dayId)),
  };
}
