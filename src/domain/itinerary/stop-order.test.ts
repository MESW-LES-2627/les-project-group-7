import { describe, it, expect } from "vitest";
import {
  moveStop,
  placeNewStop,
  removeStop,
  type PlannedStop,
  type StopPlacement,
  type TripLayout,
} from "./stop-order";

const TRIP: TripLayout = { cityId: "porto", dayIds: ["d1", "d2", "d3"] };

/** A trip with three stops on day 1, two on day 2 and none on day 3. Stop "s1" visits place "p1". */
function sampleStops(): PlannedStop[] {
  return [
    { id: "s1", dayId: "d1", placeId: "p1", position: 1 },
    { id: "s2", dayId: "d1", placeId: "p2", position: 2 },
    { id: "s3", dayId: "d1", placeId: "p3", position: 3 },
    { id: "s4", dayId: "d2", placeId: "p4", position: 1 },
    { id: "s5", dayId: "d2", placeId: "p5", position: 2 },
  ];
}

/** Saves the changes as the API would, deleting `removedId` first. */
function apply(
  stops: readonly PlannedStop[],
  changes: readonly StopPlacement[],
  removedId?: string
): PlannedStop[] {
  const byId = new Map(changes.map((change) => [change.id, change]));
  return stops
    .filter((stop) => stop.id !== removedId)
    .map((stop) => ({ ...stop, ...byId.get(stop.id) }));
}

/** The stop ids of each day in position order, and a check that the positions are 1, 2, 3. */
function layout(stops: readonly PlannedStop[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const dayId of TRIP.dayIds) {
    const day = stops
      .filter((stop) => stop.dayId === dayId)
      .sort((a, b) => a.position - b.position);
    expect(day.map((stop) => stop.position)).toEqual(
      day.map((_, index) => index + 1)
    );
    result[dayId] = day.map((stop) => stop.id);
  }
  return result;
}

function changesOf(result: ReturnType<typeof moveStop>): StopPlacement[] {
  if (!result.ok) {
    throw new Error(`expected the change to be accepted: ${result.error}`);
  }
  return result.changes;
}

function moved(
  stops: PlannedStop[],
  stopId: string,
  toDayId: string,
  toPosition: number
) {
  return layout(
    apply(stops, changesOf(moveStop(stops, TRIP, stopId, toDayId, toPosition)))
  );
}

describe("placeNewStop: a new stop goes at the end of its day", () => {
  it("is the first stop of an empty day", () => {
    expect(
      placeNewStop(sampleStops(), TRIP, { id: "p9", cityId: "porto" }, "d3")
    ).toEqual({ ok: true, position: 1, changes: [] });
  });

  it("comes after the stops already on the day", () => {
    expect(
      placeNewStop(sampleStops(), TRIP, { id: "p9", cityId: "porto" }, "d1")
    ).toEqual({ ok: true, position: 4, changes: [] });
  });

  it("closes a gap in the day first, so the new stop does not share a position", () => {
    const stops: PlannedStop[] = [
      { id: "s1", dayId: "d1", placeId: "p1", position: 1 },
      { id: "s3", dayId: "d1", placeId: "p3", position: 3 },
    ];

    expect(
      placeNewStop(stops, TRIP, { id: "p9", cityId: "porto" }, "d1")
    ).toEqual({
      ok: true,
      position: 3,
      changes: [{ id: "s3", dayId: "d1", position: 2 }],
    });
  });
});

describe("placeNewStop: a place only once per trip", () => {
  it("refuses a place already planned on the same day", () => {
    expect(
      placeNewStop(sampleStops(), TRIP, { id: "p2", cityId: "porto" }, "d1")
    ).toEqual({
      ok: false,
      reason: "ALREADY_PLANNED",
      error: "This place is already planned in this trip",
    });
  });

  it("refuses a place already planned on another day", () => {
    const result = placeNewStop(
      sampleStops(),
      TRIP,
      { id: "p4", cityId: "porto" },
      "d3"
    );

    expect(result).toMatchObject({ ok: false, reason: "ALREADY_PLANNED" });
  });

  it("accepts a place again after its stop was removed", () => {
    const stops = sampleStops();
    const removal = changesOf(removeStop(stops, "s2"));
    const afterRemoval = apply(stops, removal, "s2");

    expect(
      placeNewStop(afterRemoval, TRIP, { id: "p2", cityId: "porto" }, "d3")
    ).toMatchObject({ ok: true, position: 1 });
  });
});

describe("placeNewStop: only places of the trip's city", () => {
  it("refuses a place of another city", () => {
    expect(
      placeNewStop(sampleStops(), TRIP, { id: "p9", cityId: "paris" }, "d1")
    ).toEqual({
      ok: false,
      reason: "OTHER_CITY",
      error: "This place is not in the city of the trip",
    });
  });

  it("says another city before already planned, as the city is checked first", () => {
    expect(
      placeNewStop(sampleStops(), TRIP, { id: "p1", cityId: "paris" }, "d1")
    ).toMatchObject({ ok: false, reason: "OTHER_CITY" });
  });
});

describe("placeNewStop: the day", () => {
  it("refuses a day that is not part of the trip", () => {
    expect(
      placeNewStop(sampleStops(), TRIP, { id: "p9", cityId: "porto" }, "d9")
    ).toEqual({
      ok: false,
      reason: "UNKNOWN_DAY",
      error: "This day is not part of the trip",
    });
  });
});

describe("moveStop: inside the same day", () => {
  it("moves a stop down, and the stops it passes move up", () => {
    expect(moved(sampleStops(), "s1", "d1", 3).d1).toEqual(["s2", "s3", "s1"]);
  });

  it("moves a stop up, and the stops it passes move down", () => {
    expect(moved(sampleStops(), "s3", "d1", 1).d1).toEqual(["s3", "s1", "s2"]);
  });

  it("moves a stop by one place", () => {
    expect(moved(sampleStops(), "s2", "d1", 1).d1).toEqual(["s2", "s1", "s3"]);
  });

  it("changes nothing when the stop stays where it is", () => {
    expect(moveStop(sampleStops(), TRIP, "s2", "d1", 2)).toEqual({
      ok: true,
      changes: [],
    });
  });

  it("only changes the stops between the old and the new position", () => {
    const stops = [
      ...sampleStops(),
      { id: "s6", dayId: "d1", placeId: "p6", position: 4 },
    ];

    expect(changesOf(moveStop(stops, TRIP, "s2", "d1", 3))).toEqual([
      { id: "s3", dayId: "d1", position: 2 },
      { id: "s2", dayId: "d1", position: 3 },
    ]);
  });

  it("does not touch the other days", () => {
    const changes = changesOf(moveStop(sampleStops(), TRIP, "s1", "d1", 3));

    expect(changes.every((change) => change.dayId === "d1")).toBe(true);
  });
});

describe("moveStop: to another day", () => {
  it("puts the stop in the middle of the other day, and closes its place in the old day", () => {
    expect(moved(sampleStops(), "s2", "d2", 2)).toEqual({
      d1: ["s1", "s3"],
      d2: ["s4", "s2", "s5"],
      d3: [],
    });
  });

  it("puts the stop at the start of the other day", () => {
    expect(moved(sampleStops(), "s3", "d2", 1).d2).toEqual(["s3", "s4", "s5"]);
  });

  it("puts the stop at the end of the other day", () => {
    expect(moved(sampleStops(), "s1", "d2", 3)).toEqual({
      d1: ["s2", "s3"],
      d2: ["s4", "s5", "s1"],
      d3: [],
    });
  });

  it("puts the stop on an empty day", () => {
    expect(moved(sampleStops(), "s4", "d3", 1)).toEqual({
      d1: ["s1", "s2", "s3"],
      d2: ["s5"],
      d3: ["s4"],
    });
  });

  it("leaves a day empty when its only stop moves", () => {
    const stops: PlannedStop[] = [
      { id: "s1", dayId: "d1", placeId: "p1", position: 1 },
    ];

    expect(changesOf(moveStop(stops, TRIP, "s1", "d2", 1))).toEqual([
      { id: "s1", dayId: "d2", position: 1 },
    ]);
  });

  it("keeps the place of the stop, which is still planned only once", () => {
    const after = apply(
      sampleStops(),
      changesOf(moveStop(sampleStops(), TRIP, "s2", "d3", 1))
    );

    expect(after.filter((stop) => stop.placeId === "p2")).toEqual([
      { id: "s2", dayId: "d3", placeId: "p2", position: 1 },
    ]);
  });
});

describe("moveStop: refused moves", () => {
  it("refuses a stop that is not in the itinerary", () => {
    expect(moveStop(sampleStops(), TRIP, "s9", "d1", 1)).toEqual({
      ok: false,
      reason: "STOP_NOT_FOUND",
      error: "This stop is not in the itinerary",
    });
  });

  it("refuses a day that is not part of the trip", () => {
    expect(moveStop(sampleStops(), TRIP, "s1", "d9", 1)).toMatchObject({
      ok: false,
      reason: "UNKNOWN_DAY",
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses the position %s",
    (position) => {
      expect(moveStop(sampleStops(), TRIP, "s1", "d1", position)).toEqual({
        ok: false,
        reason: "INVALID_POSITION",
        error: "Choose a position from 1 to 3",
      });
    }
  );

  it("refuses a position after the last one in the same day", () => {
    expect(moveStop(sampleStops(), TRIP, "s1", "d1", 4)).toMatchObject({
      ok: false,
      reason: "INVALID_POSITION",
      error: "Choose a position from 1 to 3",
    });
  });

  it("allows one position more on another day, for its end, and not two", () => {
    expect(moveStop(sampleStops(), TRIP, "s1", "d2", 3)).toMatchObject({
      ok: true,
    });
    expect(moveStop(sampleStops(), TRIP, "s1", "d2", 4)).toMatchObject({
      ok: false,
      error: "Choose a position from 1 to 3",
    });
  });
});

describe("removeStop: the others keep their order", () => {
  it("removes the first stop, and the rest move up", () => {
    const stops = sampleStops();
    const changes = changesOf(removeStop(stops, "s1"));

    expect(changes).toEqual([
      { id: "s2", dayId: "d1", position: 1 },
      { id: "s3", dayId: "d1", position: 2 },
    ]);
    expect(layout(apply(stops, changes, "s1")).d1).toEqual(["s2", "s3"]);
  });

  it("removes a stop in the middle, and only the stops after it change", () => {
    expect(changesOf(removeStop(sampleStops(), "s2"))).toEqual([
      { id: "s3", dayId: "d1", position: 2 },
    ]);
  });

  it("removes the last stop, and nothing else changes", () => {
    expect(removeStop(sampleStops(), "s3")).toEqual({ ok: true, changes: [] });
  });

  it("removes the only stop of a day", () => {
    const stops = sampleStops();
    const after = apply(stops, changesOf(removeStop(stops, "s4")), "s4");

    expect(layout(after)).toEqual({
      d1: ["s1", "s2", "s3"],
      d2: ["s5"],
      d3: [],
    });
  });

  it("does not touch the other days", () => {
    const changes = changesOf(removeStop(sampleStops(), "s4"));

    expect(changes.every((change) => change.dayId === "d2")).toBe(true);
  });

  it("refuses a stop that is not in the itinerary", () => {
    expect(removeStop(sampleStops(), "s9")).toEqual({
      ok: false,
      reason: "STOP_NOT_FOUND",
      error: "This stop is not in the itinerary",
    });
  });
});

describe("positions 1, 2, 3 without gaps", () => {
  it("numbers again a day with gaps and repeated positions, in position then id order", () => {
    const stops: PlannedStop[] = [
      { id: "b", dayId: "d1", placeId: "p2", position: 5 },
      { id: "a", dayId: "d1", placeId: "p1", position: 5 },
      { id: "c", dayId: "d1", placeId: "p3", position: 2 },
      { id: "z", dayId: "d1", placeId: "p9", position: 9 },
    ];

    expect(
      layout(apply(stops, changesOf(removeStop(stops, "z")), "z"))
    ).toEqual({ d1: ["c", "a", "b"], d2: [], d3: [] });
  });

  it("keeps every day without gaps after a series of changes", () => {
    let stops = sampleStops();

    stops = apply(stops, changesOf(moveStop(stops, TRIP, "s1", "d2", 2)));
    stops = apply(stops, changesOf(moveStop(stops, TRIP, "s5", "d3", 1)));
    stops = apply(stops, changesOf(removeStop(stops, "s4")), "s4");
    stops = apply(stops, changesOf(moveStop(stops, TRIP, "s3", "d1", 1)));
    stops = apply(stops, changesOf(moveStop(stops, TRIP, "s2", "d3", 1)));

    expect(layout(stops)).toEqual({
      d1: ["s3"],
      d2: ["s1"],
      d3: ["s2", "s5"],
    });
  });

  it("does not change the stops it is given", () => {
    const stops = sampleStops();
    const copy = structuredClone(stops);

    moveStop(stops, TRIP, "s1", "d2", 1);
    removeStop(stops, "s2");
    placeNewStop(stops, TRIP, { id: "p9", cityId: "porto" }, "d1");

    expect(stops).toEqual(copy);
  });
});
