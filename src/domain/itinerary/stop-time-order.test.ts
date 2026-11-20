import { describe, it, expect } from "vitest";
import {
  moveStop,
  placeNewStop,
  setStopTime,
  type PlannedStop,
  type StopChanges,
  type StopPlacement,
  type TripLayout,
} from "./stop-order";

const TRIP: TripLayout = { cityId: "porto", dayIds: ["d1", "d2", "d3"] };
const PLACE = { id: "new-place", cityId: "porto" };

/**
 * A day written as "id@time" (or just "id" for a stop without a time), in the order of the day:
 * day("s1@10:00", "s2", "s3@14:00") is the museum, a stop with no time, and the castle.
 */
function day(dayId: string, ...items: string[]): PlannedStop[] {
  return items.map((item, index) => {
    const [id, visitTime] = item.split("@");
    return {
      id,
      dayId,
      placeId: `place-${id}`,
      position: index + 1,
      visitTime: visitTime ?? null,
    };
  });
}

function apply(
  stops: readonly PlannedStop[],
  changes: readonly StopPlacement[]
): PlannedStop[] {
  const byId = new Map(changes.map((change) => [change.id, change]));
  return stops.map((stop) => ({ ...stop, ...byId.get(stop.id) }));
}

/** The ids of a day in the order of the positions, with a check that the positions are 1, 2, 3. */
function order(stops: readonly PlannedStop[], dayId: string): string[] {
  const inDay = stops
    .filter((stop) => stop.dayId === dayId)
    .sort((a, b) => a.position - b.position);

  expect(inDay.map((stop) => stop.position)).toEqual(
    inDay.map((_, index) => index + 1)
  );
  return inDay.map((stop) => stop.id);
}

function changesOf(result: StopChanges): StopPlacement[] {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason}: ${result.error}`);
  }
  return result.changes;
}

/** Adds a stop with a time and gives the day as it is afterwards. */
function addWithTime(
  stops: PlannedStop[],
  dayId: string,
  time: string | null
): { position: number; ids: string[] } {
  const result = placeNewStop(stops, TRIP, PLACE, dayId, time);
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.reason}`);
  }

  const withNew: PlannedStop[] = [
    ...apply(stops, result.changes),
    {
      id: "NEW",
      dayId,
      placeId: PLACE.id,
      position: result.position,
      visitTime: time,
    },
  ];
  return { position: result.position, ids: order(withNew, dayId) };
}

describe("placeNewStop with a visit time", () => {
  it("puts a stop without a time at the end, even after the stops with a time", () => {
    const stops = day("d1", "a@10:00", "b", "c@14:00");

    expect(addWithTime(stops, "d1", null)).toEqual({
      position: 4,
      ids: ["a", "b", "c", "NEW"],
    });
  });

  it("puts a stop with a time after the last stop with an earlier time", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    expect(addWithTime(stops, "d1", "12:00")).toEqual({
      position: 2,
      ids: ["a", "NEW", "b"],
    });
  });

  it("goes right after the stop with an earlier time, before a stop without a time that follows it", () => {
    const stops = day("d1", "a@10:00", "free", "c@14:00");

    expect(addWithTime(stops, "d1", "12:00").ids).toEqual([
      "a",
      "NEW",
      "free",
      "c",
    ]);
  });

  it("puts a stop with the earliest time before the first stop with a time", () => {
    const stops = day("d1", "free", "a@10:00", "b@14:00");

    // After the stop without a time, right before the first stop that has a time.
    expect(addWithTime(stops, "d1", "08:00").ids).toEqual([
      "free",
      "NEW",
      "a",
      "b",
    ]);
  });

  it("puts a stop with the latest time after the last stop with a time", () => {
    const stops = day("d1", "a@10:00", "b@14:00", "free");

    expect(addWithTime(stops, "d1", "20:00").ids).toEqual([
      "a",
      "b",
      "NEW",
      "free",
    ]);
  });

  it("puts a stop with the same time after the stop that already has it", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    expect(addWithTime(stops, "d1", "10:00").ids).toEqual(["a", "NEW", "b"]);
  });

  it("puts a stop with a time at the end when no stop of the day has a time", () => {
    const stops = day("d1", "a", "b");

    expect(addWithTime(stops, "d1", "09:00")).toEqual({
      position: 3,
      ids: ["a", "b", "NEW"],
    });
  });

  it("puts a stop with a time first in an empty day", () => {
    expect(addWithTime([], "d1", "09:00")).toEqual({
      position: 1,
      ids: ["NEW"],
    });
  });

  it("only moves down the stops after the new one", () => {
    const stops = day("d1", "a@10:00", "b@14:00", "c@16:00");

    const result = placeNewStop(stops, TRIP, PLACE, "d1", "12:00");

    expect(result.ok && result.changes).toEqual([
      { id: "b", dayId: "d1", position: 3 },
      { id: "c", dayId: "d1", position: 4 },
    ]);
  });

  it("does not look at the times of the other days", () => {
    const stops = [...day("d1", "a@10:00"), ...day("d2", "x@08:00", "y@22:00")];

    expect(addWithTime(stops, "d1", "23:00").ids).toEqual(["a", "NEW"]);
    expect(addWithTime(stops, "d2", "12:00").ids).toEqual(["x", "NEW", "y"]);
  });

  it("is the same as before for a stop without a time (end of the day)", () => {
    const stops = day("d1", "a", "b");

    const withNull = placeNewStop(stops, TRIP, PLACE, "d1", null);
    const withoutArgument = placeNewStop(stops, TRIP, PLACE, "d1");

    expect(withNull).toEqual(withoutArgument);
    expect(withNull.ok && withNull.position).toBe(3);
  });

  it("still refuses the same place twice, another city and an unknown day", () => {
    const stops = day("d1", "a@10:00");

    const planned = placeNewStop(
      stops,
      TRIP,
      { id: "place-a", cityId: "porto" },
      "d1",
      "12:00"
    );
    const otherCity = placeNewStop(
      stops,
      TRIP,
      { id: "p", cityId: "paris" },
      "d1",
      "12:00"
    );
    const noDay = placeNewStop(stops, TRIP, PLACE, "dx", "12:00");

    expect(!planned.ok && planned.reason).toBe("ALREADY_PLANNED");
    expect(!otherCity.ok && otherCity.reason).toBe("OTHER_CITY");
    expect(!noDay.ok && noDay.reason).toBe("UNKNOWN_DAY");
  });
});

describe("setStopTime", () => {
  it("does not move a stop whose new time still fits where it is", () => {
    const stops = day("d1", "a@10:00", "b", "c@14:00");

    const changes = changesOf(setStopTime(stops, "b", "12:00"));

    expect(changes).toEqual([]);
  });

  it("does not move a stop that gets its first time between two others when it already fits", () => {
    const stops = day("d1", "a@10:00", "b", "c@14:00");

    expect(changesOf(setStopTime(stops, "b", "10:00"))).toEqual([]);
    expect(changesOf(setStopTime(stops, "b", "14:00"))).toEqual([]);
  });

  it("moves a stop to its place among the times when the new time breaks the order", () => {
    const stops = day("d1", "a@10:00", "b@14:00", "c");

    // c goes from the end to between a and b, as 12:00 is after 10:00 and before 14:00
    const after = apply(stops, changesOf(setStopTime(stops, "c", "12:00")));

    expect(order(after, "d1")).toEqual(["a", "c", "b"]);
  });

  it("moves a stop that had a time when its time is changed past another", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    const later = apply(stops, changesOf(setStopTime(stops, "a", "16:00")));
    expect(order(later, "d1")).toEqual(["b", "a"]);

    const earlier = apply(stops, changesOf(setStopTime(stops, "b", "08:00")));
    expect(order(earlier, "d1")).toEqual(["b", "a"]);
  });

  it("keeps the stops without a time where they are", () => {
    const stops = day("d1", "free1", "a@10:00", "free2", "b@14:00", "c");

    const after = apply(stops, changesOf(setStopTime(stops, "c", "08:00")));

    // c goes right before the first stop with a time; free1 and free2 are not reordered
    expect(order(after, "d1")).toEqual(["free1", "c", "a", "free2", "b"]);
  });

  it("goes right after the last stop with the same or an earlier time", () => {
    const stops = day("d1", "a@10:00", "free", "b@10:00", "c@14:00", "d");

    const after = apply(stops, changesOf(setStopTime(stops, "d", "10:00")));

    expect(order(after, "d1")).toEqual(["a", "free", "b", "d", "c"]);
  });

  it("never moves anything when the time is cleared", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    expect(changesOf(setStopTime(stops, "a", null))).toEqual([]);
  });

  it("only changes the day of the stop", () => {
    const stops = [...day("d1", "a@10:00", "b"), ...day("d2", "x@09:00")];

    const changes = changesOf(setStopTime(stops, "b", "08:00"));

    expect(changes.every((change) => change.dayId === "d1")).toBe(true);
  });

  it("refuses a stop that is not in the itinerary", () => {
    const result = setStopTime(day("d1", "a@10:00"), "nope", "12:00");

    expect(!result.ok && result.reason).toBe("STOP_NOT_FOUND");
  });
});

describe("moveStop and the order of the times", () => {
  it("lets a stop without a time go anywhere, between stops with a time too", () => {
    const stops = day("d1", "a@10:00", "b@14:00", "free");

    const between = apply(
      stops,
      changesOf(moveStop(stops, TRIP, "free", "d1", 2))
    );
    expect(order(between, "d1")).toEqual(["a", "free", "b"]);

    const first = apply(
      stops,
      changesOf(moveStop(stops, TRIP, "free", "d1", 1))
    );
    expect(order(first, "d1")).toEqual(["free", "a", "b"]);
  });

  it("lets a stop without a time move out from between two stops with a time", () => {
    const stops = day("d1", "a@10:00", "free", "b@14:00");

    const after = apply(
      stops,
      changesOf(moveStop(stops, TRIP, "free", "d1", 3))
    );

    expect(order(after, "d1")).toEqual(["a", "b", "free"]);
  });

  it("lets a stop with a time move where the order of the times still holds", () => {
    // a and c have times; free is between them, and a can go after free
    const stops = day("d1", "a@10:00", "free", "c@14:00");

    const after = apply(stops, changesOf(moveStop(stops, TRIP, "a", "d1", 2)));

    expect(order(after, "d1")).toEqual(["free", "a", "c"]);
  });

  it("refuses to put a stop with a time after one with a later time", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    const result = moveStop(stops, TRIP, "a", "d1", 2);

    expect(!result.ok && result.reason).toBe("TIME_ORDER");
    expect(!result.ok && result.error).toContain(
      "10:00 cannot come after 14:00"
    );
  });

  it("refuses to put a stop with a time before one with an earlier time", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    const result = moveStop(stops, TRIP, "b", "d1", 1);

    expect(!result.ok && result.reason).toBe("TIME_ORDER");
    expect(!result.ok && result.error).toContain(
      "10:00 cannot come after 14:00"
    );
  });

  it("accepts a stop with a time moved next to a stop with the same time", () => {
    const stops = day("d1", "a@10:00", "b@10:00", "c@14:00");

    const after = apply(stops, changesOf(moveStop(stops, TRIP, "a", "d1", 2)));

    expect(order(after, "d1")).toEqual(["b", "a", "c"]);
  });

  it("refuses to move a stop with a time to a place in another day where it does not fit", () => {
    const stops = [...day("d1", "a@18:00"), ...day("d2", "x@09:00", "y@12:00")];

    const result = moveStop(stops, TRIP, "a", "d2", 1);

    expect(!result.ok && result.reason).toBe("TIME_ORDER");
  });

  it("accepts a stop with a time moved to another day where it fits", () => {
    const stops = [...day("d1", "a@10:30"), ...day("d2", "x@09:00", "y@12:00")];

    const after = apply(stops, changesOf(moveStop(stops, TRIP, "a", "d2", 2)));

    expect(order(after, "d2")).toEqual(["x", "a", "y"]);
    expect(order(after, "d1")).toEqual([]);
  });

  it("puts a stop with a time in its place in another day when no position is given", () => {
    const stops = [...day("d1", "a@10:30"), ...day("d2", "x@09:00", "y@12:00")];

    const after = apply(stops, changesOf(moveStop(stops, TRIP, "a", "d2")));

    expect(order(after, "d2")).toEqual(["x", "a", "y"]);
  });

  it("puts a stop without a time at the end of another day when no position is given", () => {
    const stops = [...day("d1", "a"), ...day("d2", "x@09:00", "y@12:00")];

    const after = apply(stops, changesOf(moveStop(stops, TRIP, "a", "d2")));

    expect(order(after, "d2")).toEqual(["x", "y", "a"]);
  });

  it("changes nothing without a position in the same day", () => {
    const stops = day("d1", "a@10:00", "b@14:00");

    expect(changesOf(moveStop(stops, TRIP, "a", "d1"))).toEqual([]);
  });

  it("still refuses a position that is out of range, and an unknown day or stop", () => {
    const stops = day("d1", "a@10:00", "b");

    const range = moveStop(stops, TRIP, "a", "d1", 9);
    const noDay = moveStop(stops, TRIP, "a", "dx", 1);
    const noStop = moveStop(stops, TRIP, "nope", "d1", 1);

    expect(!range.ok && range.reason).toBe("INVALID_POSITION");
    expect(!noDay.ok && noDay.reason).toBe("UNKNOWN_DAY");
    expect(!noStop.ok && noStop.reason).toBe("STOP_NOT_FOUND");
  });
});
