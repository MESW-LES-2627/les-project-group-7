/** A stop as the rules need it */
export interface PlannedStop {
  id: string;
  dayId: string;
  placeId: string;
  position: number;
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
  | "OTHER_CITY";

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

/**
 * Checks a new stop and gives its position.
 *
 * @param stops every stop of the trip
 * @param place the place to add and the city it is in
 * @param dayId the day to add it to
 * @returns the position for the new stop, or why it cannot be added
 */
export function placeNewStop(
  stops: readonly PlannedStop[],
  trip: TripLayout,
  place: { id: string; cityId: string },
  dayId: string
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
  const changes = onlyChanged(
    stops,
    numberDay(
      day.map((stop) => stop.id),
      dayId
    )
  );

  return { ok: true, position: day.length + 1, changes };
}

/**
 * Moves a stop to a position of the same day or of another day of the trip (AC2). The stops after
 * it in its old day move up, and the stops from the new position on in the new day move down.
 *
 * @param stops every stop of the trip
 * @param stopId the stop to move
 * @param toDayId the day it goes to, which can be the day it is on
 * @param toPosition its new position
 */
export function moveStop(
  stops: readonly PlannedStop[],
  trip: TripLayout,
  stopId: string,
  toDayId: string,
  toPosition: number
): StopChanges {
  const stop = stops.find((item) => item.id === stopId);
  if (!stop) {
    return refuse("STOP_NOT_FOUND", "This stop is not in the itinerary");
  }

  if (!trip.dayIds.includes(toDayId)) {
    return refuse("UNKNOWN_DAY", "This day is not part of the trip");
  }

  const fromDay = stopsOfDay(stops, stop.dayId)
    .map((item) => item.id)
    .filter((id) => id !== stopId);
  const toDay =
    toDayId === stop.dayId
      ? fromDay
      : stopsOfDay(stops, toDayId).map((item) => item.id);

  const lastPosition = toDay.length + 1;
  if (
    !Number.isInteger(toPosition) ||
    toPosition < 1 ||
    toPosition > lastPosition
  ) {
    return refuse(
      "INVALID_POSITION",
      `Choose a position from 1 to ${lastPosition}`
    );
  }

  const newToDay = [
    ...toDay.slice(0, toPosition - 1),
    stopId,
    ...toDay.slice(toPosition - 1),
  ];

  const placements =
    toDayId === stop.dayId
      ? numberDay(newToDay, toDayId)
      : [...numberDay(fromDay, stop.dayId), ...numberDay(newToDay, toDayId)];

  return { ok: true, changes: onlyChanged(stops, placements) };
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
