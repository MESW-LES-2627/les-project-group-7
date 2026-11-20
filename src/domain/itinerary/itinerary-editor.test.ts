import { describe, it, expect } from "vitest";
import {
  ALREADY_PLANNED_MESSAGE,
  CONCURRENT_CHANGE_MESSAGE,
  GENERIC_STOP_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  addStopBody,
  mapCenter,
  stopMapPins,
  plannerSavedPlaces,
  moveOption,
  stopRequestError,
  stopsByDay,
  type EditorDay,
  type EditorStop,
} from "./itinerary-editor";

const days: EditorDay[] = [
  { id: "d2", dayNumber: 2, date: "2026-12-02" },
  { id: "d1", dayNumber: 1, date: "2026-12-01" },
  { id: "d3", dayNumber: 3, date: "2026-12-03" },
];

function stop(
  id: string,
  dayId: string,
  position: number,
  visitTime: string | null = null
): EditorStop {
  return {
    id,
    dayId,
    placeId: `p-${id}`,
    position,
    visitTime,
    place: {
      id: `p-${id}`,
      name: `Place ${id}`,
      category: "MUSEUM",
      address: "Rua 1",
      latitude: 41.1,
      longitude: -8.6,
      priceLevel: null,
    },
  };
}

describe("stopsByDay", () => {
  it("gives every day its stops in the order of their positions, and empty days too", () => {
    const stops = [stop("b", "d1", 2), stop("c", "d2", 1), stop("a", "d1", 1)];

    const byDay = stopsByDay(days, stops);

    expect(byDay.get("d1")?.map((item) => item.id)).toEqual(["a", "b"]);
    expect(byDay.get("d2")?.map((item) => item.id)).toEqual(["c"]);
    expect(byDay.get("d3")).toEqual([]);
  });
});

describe("moveOption", () => {
  const plain = [stop("a", "d1", 1), stop("b", "d1", 2), stop("c", "d2", 1)];

  it("moves up and down by sending only the position, so the stop stays on its day (AC2)", () => {
    expect(moveOption(days, plain, "b", "up")).toEqual({
      available: true,
      body: { position: 1 },
    });
    expect(moveOption(days, plain, "a", "down")).toEqual({
      available: true,
      body: { position: 2 },
    });
  });

  it("moves to the next or previous day by sending only the day, by day number (AC2)", () => {
    expect(moveOption(days, plain, "a", "next-day")).toEqual({
      available: true,
      body: { dayId: "d2" },
    });
    expect(moveOption(days, plain, "c", "previous-day")).toEqual({
      available: true,
      body: { dayId: "d1" },
    });
  });

  it("has no move past the ends: first stop up, last stop down, first day back, last day on", () => {
    const last = [...plain, stop("z", "d3", 1)];

    expect(moveOption(days, last, "a", "up")).toEqual({
      available: false,
      reason: null,
    });
    expect(moveOption(days, last, "b", "down")).toEqual({
      available: false,
      reason: null,
    });
    expect(moveOption(days, last, "a", "previous-day")).toEqual({
      available: false,
      reason: null,
    });
    expect(moveOption(days, last, "z", "next-day")).toEqual({
      available: false,
      reason: null,
    });
  });

  it("refuses with the message of the rules a move that puts the times out of order (AC12)", () => {
    const timed = [stop("a", "d1", 1, "10:00"), stop("b", "d1", 2, "14:00")];

    const option = moveOption(days, timed, "b", "up");

    expect(option.available).toBe(false);
    expect(option.available === false && option.reason).toMatch(/time/i);
  });

  it("lets a stop without a time move between two stops with a time (AC13)", () => {
    const mixed = [
      stop("a", "d1", 1, "10:00"),
      stop("b", "d1", 2, "14:00"),
      stop("c", "d1", 3),
    ];

    expect(moveOption(days, mixed, "c", "up")).toEqual({
      available: true,
      body: { position: 2 },
    });
  });

  it("is not available for a stop that is not on the page any more", () => {
    expect(moveOption(days, plain, "gone", "up")).toEqual({
      available: false,
      reason: null,
    });
  });
});

describe("addStopBody", () => {
  const catalogPlace = {
    id: "place-1",
    name: "Livraria Lello",
    latitude: 41.14,
    longitude: -8.61,
    address: "Rua das Carmelitas",
    category: "MONUMENT",
    priceLevel: "€",
  };

  it("sends only the id of a place of the catalog, without a time when none is given (AC1)", () => {
    expect(addStopBody("d1", catalogPlace, null)).toEqual({
      dayId: "d1",
      placeId: "place-1",
    });
  });

  it("sends the visit time when there is one", () => {
    expect(addStopBody("d1", catalogPlace, "12:00")).toEqual({
      dayId: "d1",
      placeId: "place-1",
      visitTime: "12:00",
    });
  });

  it("sends the data of a place found in OpenStreetMap, without the fields it does not know", () => {
    const body = addStopBody(
      "d2",
      {
        id: "osm-node-123",
        name: "Café Majestic",
        latitude: 41.147,
        longitude: -8.606,
        address: "Rua de Santa Catarina",
        category: "CAFE",
        priceLevel: null,
      },
      null
    );

    expect(body).toEqual({
      dayId: "d2",
      placeId: "osm-node-123",
      place: {
        name: "Café Majestic",
        latitude: 41.147,
        longitude: -8.606,
        address: "Rua de Santa Catarina",
        category: "CAFE",
      },
    });
  });
});

describe("stopRequestError", () => {
  it("says the place is already planned on 409 ALREADY_PLANNED (AC5)", () => {
    expect(
      stopRequestError(409, { error: "x", reason: "ALREADY_PLANNED" })
    ).toEqual({
      message: ALREADY_PLANNED_MESSAGE,
      reason: "ALREADY_PLANNED",
      reload: false,
    });
  });

  it("asks to try again and reads the itinerary again on a 409 without a reason", () => {
    expect(stopRequestError(409, { error: "x" })).toEqual({
      message: CONCURRENT_CHANGE_MESSAGE,
      reason: null,
      reload: true,
    });
  });

  it("shows the message of the API on 400, for another city or the order of the times", () => {
    expect(
      stopRequestError(400, {
        error: "This place is not in the city of the trip",
        reason: "OTHER_CITY",
      })
    ).toEqual({
      message: "This place is not in the city of the trip",
      reason: "OTHER_CITY",
      reload: false,
    });
  });

  it("shows the message of a wrong visit time first", () => {
    const result = stopRequestError(400, {
      error: "first",
      errors: { visitTime: "Use a time of the day like 09:30" },
    });

    expect(result.message).toBe("Use a time of the day like 09:30");
  });

  it("reads the itinerary again on 404: the stop was removed elsewhere", () => {
    const result = stopRequestError(404, {
      error: "This stop is not in the itinerary",
      reason: "STOP_NOT_FOUND",
    });

    expect(result.reload).toBe(true);
    expect(result.message).toContain("This stop is not in the itinerary");
  });

  it("asks to log in again on 401, and has a general message otherwise", () => {
    expect(stopRequestError(401, null).message).toBe(SESSION_EXPIRED_MESSAGE);
    expect(stopRequestError(500, "not json").message).toBe(
      GENERIC_STOP_MESSAGE
    );
    expect(stopRequestError(400, {}).message).toBe(GENERIC_STOP_MESSAGE);
  });
});

describe("stopMapPins and mapCenter", () => {
  const stopAt = (id: string, dayId: string, placeId: string, lat: number) =>
    ({
      id,
      dayId,
      placeId,
      position: 0,
      visitTime: null,
      place: {
        id: placeId,
        name: placeId,
        category: "PARK",
        address: "",
        latitude: lat,
        longitude: -8,
        priceLevel: null,
      },
    }) as EditorStop;

  it("gives one pin for a place planned on two days, with its rating from the catalog", () => {
    const pins = stopMapPins(
      [stopAt("s1", "d1", "p1", 41), stopAt("s2", "d2", "p1", 41)],
      [
        {
          id: "p1",
          name: "p1",
          category: "PARK",
          latitude: 41,
          longitude: -8,
          averageRating: 4.5,
        },
      ]
    );

    expect(pins).toHaveLength(1);
    expect(pins[0].rating).toBe(4.5);
  });

  it("has no rating for a place outside the catalog", () => {
    const [pin] = stopMapPins([stopAt("s1", "d1", "osm-1", 41)]);

    expect(pin.rating).toBeNull();
  });

  it("centers on the middle of the points, and on nothing without points", () => {
    expect(
      mapCenter([
        { latitude: 40, longitude: -8 },
        { latitude: 42, longitude: -6 },
      ])
    ).toEqual([41, -7]);
    expect(mapCenter([])).toBeUndefined();
  });
});

describe("stopMapPins with the catalog", () => {
  it("also pins the places of the city that are not planned", () => {
    const pins = stopMapPins(
      [],
      [
        {
          id: "c1",
          name: "Cafe",
          category: "CAFE",
          latitude: 41,
          longitude: -8,
          averageRating: null,
        },
      ]
    );

    expect(pins.map((pin) => pin.id)).toEqual(["c1"]);
  });
});

describe("plannerSavedPlaces", () => {
  const saved = (id: string, type: "WISHLIST" | "BOOKMARK") => ({
    type,
    savedAt: "2026-11-01T10:00:00Z",
    place: { id, name: id, category: "PARK" },
  });

  it("lists the places of the city by section and counts the others once", () => {
    const result = plannerSavedPlaces(
      [
        saved("a", "WISHLIST"),
        saved("b", "BOOKMARK"),
        saved("far", "WISHLIST"),
        saved("far", "BOOKMARK"),
      ],
      new Set(["a", "b"])
    );

    expect(result.sections.WISHLIST.map((e) => e.place.id)).toEqual(["a"]);
    expect(result.sections.BOOKMARK.map((e) => e.place.id)).toEqual(["b"]);
    expect(result.elsewhere).toBe(1);
  });
});
