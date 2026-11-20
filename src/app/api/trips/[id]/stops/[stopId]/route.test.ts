import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dayOrder,
  dayPositions,
  fakePrisma,
  sampleData,
  type FakeData,
} from "@/lib/trip-stops.fake";

const { requireUser, state } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  state: { prisma: null as unknown },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, name) =>
        (state.prisma as Record<string, unknown>)[name as string],
    }
  ),
}));
vi.mock("@/lib/guard", () => ({ requireUser }));

import { DELETE, PATCH } from "./route";

let data: FakeData;

/** Three stops on day 1 (s1, s2, s3) and two on day 2 (s4, s5). */
function sample(): FakeData {
  return sampleData([
    { dayId: "d1", placeId: "p1", position: 1 },
    { dayId: "d1", placeId: "p2", position: 2 },
    { dayId: "d1", placeId: "p3", position: 3 },
    { dayId: "d2", placeId: "p4", position: 1 },
    { dayId: "d2", placeId: "far", position: 2 },
  ]);
}

function patch(body: unknown, stopId = "s1", tripId = "t1") {
  return PATCH(
    new Request(`http://x/api/trips/${tripId}/stops/${stopId}`, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: tripId, stopId }) }
  );
}

function remove(stopId = "s1", tripId = "t1") {
  return DELETE(
    new Request(`http://x/api/trips/${tripId}/stops/${stopId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: tripId, stopId }) }
  );
}

beforeEach(() => {
  data = sample();
  state.prisma = fakePrisma(data);
  requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
});

describe("PATCH /api/trips/[id]/stops/[stopId]: move (AC2)", () => {
  it("moves a stop within its day and keeps the positions 1, 2, 3", async () => {
    const response = await patch({ position: 3 }, "s1");

    expect(response.status).toBe(200);
    expect(dayOrder(data, "d1")).toEqual(["s2", "s3", "s1"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2, 3]);

    const body = await response.json();
    expect(body.stop).toMatchObject({ id: "s1", dayId: "d1", position: 3 });
    expect(body.stops.map((stop: { id: string }) => stop.id)).toEqual([
      "s2",
      "s3",
      "s1",
      "s4",
      "s5",
    ]);
  });

  it("moves a stop to a position of another day and closes the gap it leaves", async () => {
    const response = await patch({ dayId: "d2", position: 1 }, "s2");

    expect(response.status).toBe(200);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s3"]);
    expect(dayOrder(data, "d2")).toEqual(["s2", "s4", "s5"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2]);
    expect(dayPositions(data, "d2")).toEqual([1, 2, 3]);
  });

  it("puts a stop last in another day when only the day is sent", async () => {
    await patch({ dayId: "d2" }, "s1");

    expect(dayOrder(data, "d2")).toEqual(["s4", "s5", "s1"]);
    expect(dayOrder(data, "d1")).toEqual(["s2", "s3"]);
  });

  it("puts a stop on an empty day", async () => {
    await patch({ dayId: "d3", position: 1 }, "s3");

    expect(dayOrder(data, "d3")).toEqual(["s3"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2]);
  });

  it("changes nothing when the stop is sent to the place it is in", async () => {
    const before = structuredClone(data.stops);

    const response = await patch({ dayId: "d1", position: 1 }, "s1");

    expect(response.status).toBe(200);
    expect(data.stops).toEqual(before);
  });

  it("keeps the visit time of a stop that moves", async () => {
    data.stops[0].visitTime = "09:00";

    await patch({ dayId: "d2", position: 1 }, "s1");

    expect(data.stops.find((stop) => stop.id === "s1")?.visitTime).toBe(
      "09:00"
    );
  });

  it("refuses a position that is not from 1 to the end of the day", async () => {
    // Day 2 has two stops: moving there from day 1 can go up to position 3.
    for (const position of [0, -1, 4, 99]) {
      const response = await patch({ dayId: "d2", position }, "s1");

      expect(response.status).toBe(400);
      expect((await response.json()).reason).toBe("INVALID_POSITION");
    }
    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "s3"]);
  });

  it("refuses a position that is not a whole number", async () => {
    for (const position of [1.5, "2", null, true]) {
      const response = await patch({ position }, "s1");

      expect(response.status).toBe(400);
      expect((await response.json()).errors.position).toBeDefined();
    }
  });

  it("refuses a day that is not a day of the trip and changes nothing", async () => {
    const before = structuredClone(data.stops);

    const response = await patch({ dayId: "other-day", position: 1 }, "s1");

    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("UNKNOWN_DAY");
    expect(data.stops).toEqual(before);
  });

  it("refuses an empty day", async () => {
    const response = await patch({ dayId: "  " }, "s1");

    expect(response.status).toBe(400);
    expect((await response.json()).errors.dayId).toBe("Choose the day");
  });
});

describe("PATCH /api/trips/[id]/stops/[stopId]: visit time (AC3)", () => {
  it("sets the visit time and shows it in the answer", async () => {
    const response = await patch({ visitTime: "14:15" }, "s2");

    expect(response.status).toBe(200);
    expect((await response.json()).stop.visitTime).toBe("14:15");
    expect(data.stops.find((stop) => stop.id === "s2")?.visitTime).toBe(
      "14:15"
    );
    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "s3"]);
  });

  it("clears the visit time with null or an empty text", async () => {
    data.stops[0].visitTime = "09:00";
    data.stops[1].visitTime = "10:00";

    await patch({ visitTime: null }, "s1");
    await patch({ visitTime: "" }, "s2");

    expect(data.stops[0].visitTime).toBeNull();
    expect(data.stops[1].visitTime).toBeNull();
  });

  it("accepts any time of the day, with or without hour limits (AC7, AC8)", async () => {
    for (const visitTime of ["00:00", "22:30", "23:59"]) {
      const response = await patch({ visitTime }, "s1");

      expect(response.status).toBe(200);
    }
  });

  it("refuses a time that is not a time of the day and changes nothing", async () => {
    for (const visitTime of ["24:00", "9:30", "noon", 930]) {
      const response = await patch({ visitTime }, "s1");

      expect(response.status).toBe(400);
      expect((await response.json()).errors.visitTime).toBeDefined();
    }
    expect(data.stops[0].visitTime).toBeNull();
  });

  it("moves and sets the time in one request", async () => {
    await patch({ position: 2, visitTime: "11:00" }, "s1");

    expect(dayOrder(data, "d1")).toEqual(["s2", "s1", "s3"]);
    expect(data.stops.find((stop) => stop.id === "s1")?.visitTime).toBe(
      "11:00"
    );
  });

  it("changes neither when the move is refused", async () => {
    const response = await patch({ position: 9, visitTime: "11:00" }, "s1");

    expect(response.status).toBe(400);
    expect(data.stops[0].visitTime).toBeNull();
    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "s3"]);
  });
});

describe("PATCH /api/trips/[id]/stops/[stopId]: other answers", () => {
  it("asks for something to change", async () => {
    const response = await patch({}, "s1");

    expect(response.status).toBe(400);
  });

  it("answers 400 for a body that is not a JSON object", async () => {
    for (const body of ["{not json", "[]", "null"]) {
      expect((await patch(body)).status).toBe(400);
    }
  });

  it("answers 404 for a stop that is not in the trip", async () => {
    const response = await patch({ position: 1 }, "nope");

    expect(response.status).toBe(404);
    expect((await response.json()).reason).toBe("STOP_NOT_FOUND");
  });

  it("answers 404 for the stop of another trip, even with only a visit time", async () => {
    const response = await patch({ visitTime: "10:00" }, "s-of-another-trip");

    expect(response.status).toBe(404);
  });

  it("answers 404 for a trip that does not exist or is not the user's", async () => {
    const missing = await patch({ position: 1 }, "s1", "nope");

    requireUser.mockResolvedValue({ ok: true, user: { id: "someone-else" } });
    const notTheirs = await patch({ position: 1 }, "s1");

    expect(missing.status).toBe(404);
    expect(notTheirs.status).toBe(404);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "s3"]);
  });

  it("answers what the guard says and changes nothing without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await patch({ position: 3 }, "s1");

    expect(response.status).toBe(401);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "s3"]);
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.prisma = {
      $transaction: async () => {
        throw new Error("down");
      },
    };

    expect((await patch({ position: 2 }, "s1")).status).toBe(500);
  });
});

describe("DELETE /api/trips/[id]/stops/[stopId] (AC4)", () => {
  it("removes the stop and answers 204", async () => {
    const response = await remove("s2");

    expect(response.status).toBe(204);
    expect(data.stops.map((stop) => stop.id)).not.toContain("s2");
  });

  it("moves the stops after it up by one and keeps their order", async () => {
    await remove("s1");

    expect(dayOrder(data, "d1")).toEqual(["s2", "s3"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2]);
  });

  it("leaves the stops of the other days as they are", async () => {
    const before = data.stops
      .filter((stop) => stop.dayId === "d2")
      .map((stop) => ({ ...stop }));

    await remove("s1");

    expect(data.stops.filter((stop) => stop.dayId === "d2")).toEqual(before);
  });

  it("removes the last stop of a day without touching the others", async () => {
    await remove("s3");

    expect(dayOrder(data, "d1")).toEqual(["s1", "s2"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2]);
  });

  it("lets the place be added again afterwards", async () => {
    await remove("s1");

    expect(data.stops.some((stop) => stop.placeId === "p1")).toBe(false);
  });

  it("answers 404 for a stop that is not in the trip, and removes nothing", async () => {
    const response = await remove("nope");

    expect(response.status).toBe(404);
    expect((await response.json()).reason).toBe("STOP_NOT_FOUND");
    expect(data.stops).toHaveLength(5);
  });

  it("answers 404 for a trip that does not exist or is not the user's", async () => {
    const missing = await remove("s1", "nope");

    requireUser.mockResolvedValue({ ok: true, user: { id: "someone-else" } });
    const notTheirs = await remove("s1");

    expect(missing.status).toBe(404);
    expect(notTheirs.status).toBe(404);
    expect(data.stops).toHaveLength(5);
  });

  it("answers what the guard says and removes nothing without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await remove("s1");

    expect(response.status).toBe(401);
    expect(data.stops).toHaveLength(5);
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.prisma = {
      $transaction: async () => {
        throw new Error("down");
      },
    };

    expect((await remove("s1")).status).toBe(500);
  });
});

describe("PATCH /api/trips/[id]/stops/[stopId]: the stops with a time keep the order of their times", () => {
  beforeEach(() => {
    // Day 1: the museum at 10:00 (s1), the castle at 14:00 (s2), a café with no time (s3)
    data = sampleData([
      { dayId: "d1", placeId: "p1", position: 1, visitTime: "10:00" },
      { dayId: "d1", placeId: "p2", position: 2, visitTime: "14:00" },
      { dayId: "d1", placeId: "p3", position: 3 },
    ]);
    state.prisma = fakePrisma(data);
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("moves a stop that gets a time to its place among the times", async () => {
    const response = await patch({ visitTime: "12:00" }, "s3");

    expect(response.status).toBe(200);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s3", "s2"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2, 3]);

    const body = await response.json();
    expect(body.stop).toMatchObject({
      id: "s3",
      position: 2,
      visitTime: "12:00",
    });
    expect(body.stops.map((stop: { id: string }) => stop.id)).toEqual([
      "s1",
      "s3",
      "s2",
    ]);
  });

  it("leaves a stop where it is when its new time still fits", async () => {
    // Put the café between the museum and the castle, then give it a time that fits there
    await patch({ position: 2 }, "s3");

    const response = await patch({ visitTime: "11:30" }, "s3");

    expect(response.status).toBe(200);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s3", "s2"]);
  });

  it("moves a stop whose time is changed past another one", async () => {
    await patch({ visitTime: "16:00" }, "s1");

    expect(dayOrder(data, "d1")).toEqual(["s2", "s1", "s3"]);
    expect(dayPositions(data, "d1")).toEqual([1, 2, 3]);
  });

  it("keeps the stop where it is when its time is cleared", async () => {
    await patch({ visitTime: null }, "s1");

    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "s3"]);
    expect(data.stops.find((stop) => stop.id === "s1")?.visitTime).toBeNull();
  });

  it("lets a stop without a time be put between the stops with a time, and stay there", async () => {
    const response = await patch({ position: 2 }, "s3");

    expect(response.status).toBe(200);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s3", "s2"]);

    // moving the museum to the end of the day is refused, the café does not make it possible
    const refused = await patch({ position: 3 }, "s1");
    expect(refused.status).toBe(400);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s3", "s2"]);
  });

  it("refuses to move a stop with a time past a stop with a later or earlier time, and changes nothing", async () => {
    const before = structuredClone(data.stops);

    const museumLast = await patch({ position: 3 }, "s1");
    const castleFirst = await patch({ position: 1 }, "s2");

    for (const response of [museumLast, castleFirst]) {
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.reason).toBe("TIME_ORDER");
      expect(body.error).toContain("10:00 cannot come after 14:00");
    }
    expect(data.stops).toEqual(before);
  });

  it("refuses a time together with a position that would break the order, and saves neither", async () => {
    const before = structuredClone(data.stops);

    // The café at 09:00 in position 3 would be after the 10:00 and 14:00 stops
    const response = await patch({ position: 3, visitTime: "09:00" }, "s3");

    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("TIME_ORDER");
    expect(data.stops).toEqual(before);
  });

  it("accepts a time together with a position that fits", async () => {
    const response = await patch({ position: 2, visitTime: "12:00" }, "s3");

    expect(response.status).toBe(200);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s3", "s2"]);
    expect(data.stops.find((stop) => stop.id === "s3")?.visitTime).toBe(
      "12:00"
    );
  });

  it("moves a stop with a time to another day, to its place among the times", async () => {
    data.stops.push(
      {
        id: "x1",
        itineraryId: "i1",
        dayId: "d2",
        placeId: "p4",
        position: 1,
        visitTime: "09:00",
      },
      {
        id: "x2",
        itineraryId: "i1",
        dayId: "d2",
        placeId: "far",
        position: 2,
        visitTime: "13:00",
      }
    );

    const response = await patch({ dayId: "d2" }, "s1");

    // 10:00 goes between 09:00 and 13:00, not at the end
    expect(response.status).toBe(200);
    expect(dayOrder(data, "d2")).toEqual(["x1", "s1", "x2"]);
    expect(dayOrder(data, "d1")).toEqual(["s2", "s3"]);
  });

  it("puts a stop without a time at the end of another day", async () => {
    data.stops.push({
      id: "x1",
      itineraryId: "i1",
      dayId: "d2",
      placeId: "p4",
      position: 1,
      visitTime: "09:00",
    });

    await patch({ dayId: "d2" }, "s3");

    expect(dayOrder(data, "d2")).toEqual(["x1", "s3"]);
  });
});

describe("the stops of a trip: a change locks the itinerary first", () => {
  beforeEach(() => {
    data = sample();
    state.prisma = fakePrisma(data);
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("locks the itinerary for a move, a time and a removal", async () => {
    await patch({ position: 2 }, "s1");
    await patch({ visitTime: "10:00" }, "s2");
    await remove("s3");

    expect(data.locks).toEqual(["i1", "i1", "i1"]);
  });

  it("does not lock anything for a trip of another user", async () => {
    requireUser.mockResolvedValue({ ok: true, user: { id: "someone-else" } });

    await patch({ position: 2 }, "s1");
    await remove("s3");

    expect(data.locks).toEqual([]);
  });

  it("answers 409 for a deadlock in a move or a removal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.prisma = {
      $transaction: async () => {
        throw new Error(
          'PostgresError { code: "40P01", message: "deadlock detected" }'
        );
      },
    };

    expect((await patch({ position: 2 }, "s1")).status).toBe(409);
    expect((await remove("s1")).status).toBe(409);
  });
});
