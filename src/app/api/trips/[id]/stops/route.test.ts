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

import { POST } from "./route";

let data: FakeData;

function call(body: unknown, tripId = "t1") {
  return POST(
    new Request(`http://x/api/trips/${tripId}/stops`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: tripId }) }
  );
}

describe("POST /api/trips/[id]/stops", () => {
  beforeEach(() => {
    data = sampleData();
    state.prisma = fakePrisma(data);
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("adds a place as the last stop of the day and answers 201 (AC1)", async () => {
    const first = await call({ dayId: "d1", placeId: "p1" });
    const second = await call({ dayId: "d1", placeId: "p2" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const body = await second.json();
    expect(body.stop).toMatchObject({
      dayId: "d1",
      placeId: "p2",
      position: 2,
      visitTime: null,
    });
    expect(body.stops.map((stop: { placeId: string }) => stop.placeId)).toEqual(
      ["p1", "p2"]
    );
    expect(dayPositions(data, "d1")).toEqual([1, 2]);
  });

  it("starts the positions of each day at 1", async () => {
    await call({ dayId: "d1", placeId: "p1" });
    const response = await call({ dayId: "d2", placeId: "p2" });

    expect((await response.json()).stop.position).toBe(1);
  });

  it("saves the visit time that is sent (AC3)", async () => {
    const response = await call({
      dayId: "d1",
      placeId: "p1",
      visitTime: "10:30",
    });

    expect((await response.json()).stop.visitTime).toBe("10:30");
    expect(data.stops[0].visitTime).toBe("10:30");
  });

  it("accepts 22:30 and 00:00, because only the day itself is a limit (AC7)", async () => {
    const late = await call({ dayId: "d1", placeId: "p1", visitTime: "22:30" });
    const midnight = await call({
      dayId: "d1",
      placeId: "p2",
      visitTime: "00:00",
    });

    expect(late.status).toBe(201);
    expect(midnight.status).toBe(201);
  });

  it("does not read the hour limits of the itinerary (AC8)", async () => {
    // The fake database has no itinerary settings to read: the route only asks for the itinerary's id.
    const response = await call({
      dayId: "d1",
      placeId: "p1",
      visitTime: "22:30",
    });

    expect(response.status).toBe(201);
  });

  it("tells that a place is already planned, on the same or on another day (AC5)", async () => {
    await call({ dayId: "d1", placeId: "p1" });

    for (const dayId of ["d1", "d2"]) {
      const response = await call({ dayId, placeId: "p1" });

      expect(response.status).toBe(409);
      expect((await response.json()).reason).toBe("ALREADY_PLANNED");
    }
    expect(data.stops).toHaveLength(1);
  });

  it("refuses a place of another city and saves nothing (AC6)", async () => {
    const response = await call({ dayId: "d1", placeId: "far" });

    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("OTHER_CITY");
    expect(data.stops).toHaveLength(0);
  });

  it("refuses a day that is not a day of the trip", async () => {
    const response = await call({ dayId: "other-day", placeId: "p1" });

    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("UNKNOWN_DAY");
    expect(data.stops).toHaveLength(0);
  });

  it("refuses a place that does not exist", async () => {
    const response = await call({ dayId: "d1", placeId: "nope" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.placeId).toBe("This place does not exist");
    expect(data.stops).toHaveLength(0);
  });

  it("gives one message for each missing or wrong field", async () => {
    const response = await call({ visitTime: "25:00" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(Object.keys(body.errors).sort()).toEqual([
      "dayId",
      "placeId",
      "visitTime",
    ]);
    expect(data.stops).toHaveLength(0);
  });

  it("answers 400 for a body that is not a JSON object", async () => {
    for (const body of ["{not json", "[]", "null", '"text"']) {
      const response = await call(body);

      expect(response.status).toBe(400);
    }
  });

  it("answers 404 for a trip that does not exist or is not the user's", async () => {
    const missing = await call({ dayId: "d1", placeId: "p1" }, "nope");

    requireUser.mockResolvedValue({ ok: true, user: { id: "someone-else" } });
    const notTheirs = await call({ dayId: "d1", placeId: "p1" });

    expect(missing.status).toBe(404);
    expect(notTheirs.status).toBe(404);
    expect(data.stops).toHaveLength(0);
  });

  it("answers what the guard says and adds nothing without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await call({ dayId: "d1", placeId: "p1" });

    expect(response.status).toBe(401);
    expect(data.stops).toHaveLength(0);
  });

  it("repairs a day whose positions have a gap while it adds", async () => {
    data = sampleData([
      { dayId: "d1", position: 1 },
      { dayId: "d1", position: 4 },
    ]);
    state.prisma = fakePrisma(data);

    const response = await call({ dayId: "d1", placeId: "p3" });

    expect(response.status).toBe(201);
    expect(dayPositions(data, "d1")).toEqual([1, 2, 3]);
    expect(dayOrder(data, "d1")).toEqual(["s1", "s2", "new3"]);
  });

  it("answers 409 and saves nothing when the database refuses two changes at once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.prisma = {
      $transaction: async () => {
        throw Object.assign(new Error("write conflict"), { code: "P2034" });
      },
    };

    const response = await call({ dayId: "d1", placeId: "p1" });

    expect(response.status).toBe(409);
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.prisma = {
      $transaction: async () => {
        throw new Error("down");
      },
    };

    const response = await call({ dayId: "d1", placeId: "p1" });

    expect(response.status).toBe(500);
  });
});
