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

import { GET, POST } from "./route";

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

/** A place of the map that the catalog does not have, inside Porto. */
const MAP_PLACE = {
  name: "Livraria Lello",
  latitude: 41.1469,
  longitude: -8.6148,
  address: "Rua das Carmelitas, Porto",
  category: "MONUMENT",
  priceLevel: "€",
};

describe("POST /api/trips/[id]/stops: a place of the map that is not in the catalog", () => {
  beforeEach(() => {
    data = sampleData();
    state.prisma = fakePrisma(data);
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("saves the place in the city of the trip and adds the stop", async () => {
    const response = await call({
      dayId: "d1",
      placeId: "osm-node-4242",
      place: MAP_PLACE,
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.stop).toMatchObject({
      placeId: "osm-node-4242",
      position: 1,
      place: { id: "osm-node-4242", name: "Livraria Lello", priceLevel: "€" },
    });

    const saved = data.places.find((item) => item.id === "osm-node-4242");
    expect(saved).toMatchObject({
      osmId: "node/4242",
      cityId: "city-porto",
      source: "LAZY_OSM",
      name: "Livraria Lello",
      category: "MONUMENT",
    });
  });

  it("uses the place of the catalog that has the same OpenStreetMap id, instead of a second copy", async () => {
    data.places[0].osmId = "node/4242";
    const placesBefore = data.places.length;

    const response = await call({
      dayId: "d1",
      placeId: "osm-node-4242",
      place: MAP_PLACE,
    });

    expect(response.status).toBe(201);
    expect(data.places).toHaveLength(placesBefore);
    expect((await response.json()).stop.placeId).toBe("p1");
  });

  it("tells that it is already planned when the catalog's copy of the place is already a stop", async () => {
    data.places[0].osmId = "node/4242";
    await call({ dayId: "d1", placeId: "p1" });

    const response = await call({
      dayId: "d2",
      placeId: "osm-node-4242",
      place: MAP_PLACE,
    });

    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe("ALREADY_PLANNED");
    expect(data.stops).toHaveLength(1);
  });

  it("does not need the data again when the place is already saved", async () => {
    await call({ dayId: "d1", placeId: "osm-node-4242", place: MAP_PLACE });

    // The same id is now in the catalog: adding it again is just "already planned".
    const again = await call({ dayId: "d2", placeId: "osm-node-4242" });

    expect(again.status).toBe(409);
    expect(
      data.places.filter((item) => item.id === "osm-node-4242")
    ).toHaveLength(1);
  });

  it("refuses a place outside the city of the trip and saves nothing (AC6)", async () => {
    const placesBefore = data.places.length;

    // Lisbon, and Paris: both far from Porto.
    for (const position of [
      { latitude: 38.7223, longitude: -9.1393 },
      { latitude: 48.8584, longitude: 2.2945 },
    ]) {
      const response = await call({
        dayId: "d1",
        placeId: "osm-node-1",
        place: { ...MAP_PLACE, ...position },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.reason).toBe("OTHER_CITY");
      expect(body.error).toContain("outside Porto");
    }

    expect(data.places).toHaveLength(placesBefore);
    expect(data.stops).toHaveLength(0);
  });

  it("refuses a place of the map when it comes without its data", async () => {
    const response = await call({ dayId: "d1", placeId: "osm-node-4242" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.placeId).toContain("send its data");
    expect(data.places.some((item) => item.id === "osm-node-4242")).toBe(false);
  });

  it("refuses data that is wrong, and saves neither the place nor the stop", async () => {
    for (const place of [
      { ...MAP_PLACE, name: "" },
      { ...MAP_PLACE, latitude: "41.1" },
      { ...MAP_PLACE, longitude: null },
    ]) {
      const response = await call({
        dayId: "d1",
        placeId: "osm-node-4242",
        place,
      });

      expect(response.status).toBe(400);
    }

    expect(data.places.some((item) => item.id === "osm-node-4242")).toBe(false);
    expect(data.stops).toHaveLength(0);
  });

  it("does not save the place when the day is not a day of the trip", async () => {
    const response = await call({
      dayId: "other-day",
      placeId: "osm-node-4242",
      place: MAP_PLACE,
    });

    expect(response.status).toBe(400);
    expect((await response.json()).reason).toBe("UNKNOWN_DAY");
    expect(data.places.some((item) => item.id === "osm-node-4242")).toBe(false);
  });

  it("does not trust the data of a place that is already in the catalog", async () => {
    // The place "p2" exists: the data sent with it is ignored, the catalog's is used.
    const response = await call({
      dayId: "d1",
      placeId: "p2",
      place: { ...MAP_PLACE, name: "Hacked", latitude: 0, longitude: 0 },
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.stop.place.name).toBe("Place p2");
  });

  it("answers 409 and saves nothing when two people add the same new place at the same moment", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // The database refuses the second save of the same place (unique id): the whole change is undone.
    data.places.push({
      id: "osm-node-4242",
      osmId: null,
      name: "x",
      category: "OTHER",
      address: "x",
      latitude: 0,
      longitude: 0,
      priceLevel: null,
      cityId: "city-porto",
    });
    state.prisma = fakePrisma(data, { placesLookupMisses: true });

    const response = await call({
      dayId: "d1",
      placeId: "osm-node-4242",
      place: MAP_PLACE,
    });

    expect(response.status).toBe(409);
    expect(data.stops).toHaveLength(0);
  });
});

function list(tripId = "t1") {
  return GET(new Request(`http://x/api/trips/${tripId}/stops`), {
    params: Promise.resolve({ id: tripId }),
  });
}

describe("GET /api/trips/[id]/stops", () => {
  beforeEach(() => {
    data = sampleData([
      { dayId: "d2", placeId: "p1", position: 1 },
      { dayId: "d1", placeId: "p2", position: 2, visitTime: "10:00" },
      { dayId: "d1", placeId: "p3", position: 1 },
    ]);
    state.prisma = fakePrisma(data);
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("lists the stops by day and then by position, with their places", async () => {
    const response = await list();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stops.map((stop: { id: string }) => stop.id)).toEqual([
      "s3",
      "s2",
      "s1",
    ]);
    expect(body.stops[1]).toEqual({
      id: "s2",
      dayId: "d1",
      placeId: "p2",
      position: 2,
      visitTime: "10:00",
      place: {
        id: "p2",
        name: "Place p2",
        category: "MONUMENT",
        address: "1 Rua do Teste",
        latitude: 41.151,
        longitude: -8.62,
        priceLevel: null,
      },
    });
  });

  it("gives an empty list for a trip without stops", async () => {
    data.stops.length = 0;

    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).stops).toEqual([]);
  });

  it("answers 404 for a trip that does not exist or is not the user's", async () => {
    const missing = await list("nope");

    requireUser.mockResolvedValue({ ok: true, user: { id: "someone-else" } });
    const notTheirs = await list();

    expect(missing.status).toBe(404);
    expect(notTheirs.status).toBe(404);
  });

  it("answers what the guard says without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    expect((await list()).status).toBe(401);
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.prisma = {
      trip: {
        findFirst: async () => {
          throw new Error("down");
        },
      },
    };

    expect((await list()).status).toBe(500);
  });
});
