import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteMany, requireUser, tx, lockItinerary } = vi.hoisted(() => {
  const tx = {
    trip: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    day: { deleteMany: vi.fn(), update: vi.fn(), createMany: vi.fn() },
  };
  return {
    deleteMany: tx.trip.deleteMany,
    requireUser: vi.fn(),
    lockItinerary: vi.fn(),
    tx,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (run: (t: typeof tx) => unknown) => run(tx),
  },
}));
vi.mock("@/lib/guard", () => ({ requireUser }));
vi.mock("@/lib/trip-stops", () => ({
  lockItinerary,
  STOPS_TRANSACTION: {},
}));

import { DELETE, PATCH } from "./route";

function call(id = "t1") {
  return DELETE(new Request(`http://x/api/trips/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/trips/[id]", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    lockItinerary.mockReset();
    lockItinerary.mockResolvedValue(true);
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("deletes a trip of the user and answers 204", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    const response = await call("t1");

    expect(response.status).toBe(204);

    // The owner is in the filter, so another user's trip can never match.
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "t1", userId: "u1" },
    });
  });

  it("answers 404 when there is no such trip or it is not the user's", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    const response = await call("other");

    expect(response.status).toBe(404);
  });

  it("takes the lock of the itinerary before it deletes, like the edit and the stops do", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    await call("t1");

    expect(lockItinerary).toHaveBeenCalledWith(tx, "t1", "u1");
    expect(lockItinerary.mock.invocationCallOrder[0]).toBeLessThan(
      deleteMany.mock.invocationCallOrder[0]
    );
  });

  it("still deletes a trip that has no itinerary to lock", async () => {
    lockItinerary.mockResolvedValue(false);
    deleteMany.mockResolvedValue({ count: 1 });

    const response = await call("t1");

    expect(response.status).toBe(204);
  });

  it("answers what the guard says and deletes nothing without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await call();

    expect(response.status).toBe(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteMany.mockRejectedValue(new Error("down"));

    const response = await call();

    expect(response.status).toBe(500);
  });
});

const day = (dayNumber: number, date: string, stops = 0) => ({
  id: `d${dayNumber}`,
  dayNumber,
  date: new Date(`${date}T00:00:00.000Z`),
  _count: { stops },
});

// A trip of three days, 2030-05-10 to 2030-05-12, with two stops on day 3.
function storedTrip() {
  return {
    id: "t1",
    name: "Porto",
    cityId: "c1",
    startDate: new Date("2030-05-10T00:00:00.000Z"),
    endDate: new Date("2030-05-12T00:00:00.000Z"),
    city: { timezone: "Europe/Lisbon" },
    days: [day(1, "2030-05-10"), day(2, "2030-05-11"), day(3, "2030-05-12", 2)],
  };
}

function patch(body: unknown) {
  return PATCH(
    new Request("http://x/api/trips/t1", {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "t1" }) }
  );
}

describe("PATCH /api/trips/[id]", () => {
  const same = {
    name: "Porto",
    startDate: "2030-05-10",
    endDate: "2030-05-12",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
    lockItinerary.mockResolvedValue(true);
    tx.trip.findFirst.mockImplementation(async () => storedTrip());
    tx.trip.findFirstOrThrow.mockImplementation(async () => ({
      ...storedTrip(),
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      days: [],
      itinerary: {
        id: "i1",
        mode: "MANUAL",
        budgetLevel: null,
        dayStart: null,
        dayEnd: null,
      },
    }));
  });

  it("takes the lock of the itinerary first (the same as the stops)", async () => {
    await patch(same);

    expect(lockItinerary).toHaveBeenCalledWith(tx, "t1", "u1");
  });

  it("adds empty days at the end when the end date is later (AC1)", async () => {
    const response = await patch({ ...same, endDate: "2030-05-14" });

    expect(response.status).toBe(200);
    expect(tx.day.createMany).toHaveBeenCalledWith({
      data: [
        {
          dayNumber: 4,
          date: new Date("2030-05-13T00:00:00.000Z"),
          tripId: "t1",
        },
        {
          dayNumber: 5,
          date: new Date("2030-05-14T00:00:00.000Z"),
          tripId: "t1",
        },
      ],
    });
    expect(tx.day.deleteMany).toHaveBeenCalledWith({
      where: { tripId: "t1", dayNumber: { in: [] } },
    });
  });

  it("warns first when a day with stops would go, and changes nothing (AC2)", async () => {
    const response = await patch({ ...same, endDate: "2030-05-11" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      removal: { days: [{ dayNumber: 3, date: "2030-05-12", stops: 2 }] },
    });
    expect(tx.trip.update).not.toHaveBeenCalled();
    expect(tx.day.deleteMany).not.toHaveBeenCalled();
  });

  it("removes the day and its stops once the person confirms (AC2)", async () => {
    const response = await patch({
      ...same,
      endDate: "2030-05-11",
      confirmedStops: 2,
    });

    expect(response.status).toBe(200);
    expect(tx.day.deleteMany).toHaveBeenCalledWith({
      where: { tripId: "t1", dayNumber: { in: [3] } },
    });
    expect(tx.trip.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: {
        name: "Porto",
        startDate: new Date("2030-05-10T00:00:00.000Z"),
        endDate: new Date("2030-05-11T00:00:00.000Z"),
      },
    });
  });

  it("warns again when the number of stops changed after the warning (AC2)", async () => {
    // The person was told 1 stop would go, but day 3 has 2 stops now.
    const response = await patch({
      ...same,
      endDate: "2030-05-11",
      confirmedStops: 1,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      removal: { days: [{ dayNumber: 3, stops: 2 }] },
    });
    expect(tx.day.deleteMany).not.toHaveBeenCalled();
  });

  it("removes days without stops without asking", async () => {
    // The only stop is on day 1, so day 3 is empty and can go without a warning.
    tx.trip.findFirst.mockResolvedValueOnce({
      ...storedTrip(),
      days: [
        day(1, "2030-05-10", 1),
        day(2, "2030-05-11"),
        day(3, "2030-05-12"),
      ],
    });

    const response = await patch({ ...same, endDate: "2030-05-11" });

    expect(response.status).toBe(200);
    expect(tx.day.deleteMany).toHaveBeenCalledWith({
      where: { tripId: "t1", dayNumber: { in: [3] } },
    });
  });

  it("gives every day its new date when the start date moves, and keeps the numbers (AC3)", async () => {
    const response = await patch({
      ...same,
      startDate: "2030-05-11",
      endDate: "2030-05-13",
    });

    expect(response.status).toBe(200);
    expect(tx.day.update.mock.calls).toEqual([
      [
        {
          where: { id: "d1" },
          data: { date: new Date("2030-05-11T00:00:00.000Z") },
        },
      ],
      [
        {
          where: { id: "d2" },
          data: { date: new Date("2030-05-12T00:00:00.000Z") },
        },
      ],
      [
        {
          where: { id: "d3" },
          data: { date: new Date("2030-05-13T00:00:00.000Z") },
        },
      ],
    ]);
    expect(tx.day.deleteMany).toHaveBeenCalledWith({
      where: { tripId: "t1", dayNumber: { in: [] } },
    });
    expect(tx.day.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("answers 400 with one message for each wrong field and changes nothing (AC4)", async () => {
    const response = await patch({ name: " ", startDate: "x", endDate: "" });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(Object.keys(body.errors).sort()).toEqual([
      "endDate",
      "name",
      "startDate",
    ]);
    expect(tx.trip.update).not.toHaveBeenCalled();
  });

  it("refuses a start date in the past when it changes (AC4)", async () => {
    const response = await patch({ ...same, startDate: "2020-01-01" });

    expect(response.status).toBe(400);
    expect(tx.trip.update).not.toHaveBeenCalled();
  });

  it("saves a new name and answers with the trip (AC5)", async () => {
    const response = await patch({ ...same, name: "  Weekend in Porto " });

    expect(response.status).toBe(200);
    expect(tx.trip.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ name: "Weekend in Porto" }),
    });
    expect(await response.json()).toMatchObject({ id: "t1" });
  });

  it("lists the days of the warning in day order, whatever order the database gives them", async () => {
    // After the dates of some days were updated, the database returns the days in another order
    tx.trip.findFirst.mockResolvedValueOnce({
      ...storedTrip(),
      endDate: new Date("2030-05-14T00:00:00.000Z"),
      days: [
        day(1, "2030-05-10"),
        day(2, "2030-05-11"),
        day(5, "2030-05-14", 2),
        day(3, "2030-05-12", 2),
        day(4, "2030-05-13", 1),
      ],
    });

    const response = await patch({ ...same, endDate: "2030-05-11" });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(
      body.removal.days.map((d: { dayNumber: number }) => d.dayNumber)
    ).toEqual([3, 4, 5]);
  });

  it("answers 404, not 500, when the trip was deleted while the request waited for the lock", async () => {
    tx.trip.findFirst.mockResolvedValue(null);

    const response = await patch(same);

    expect(response.status).toBe(404);
    expect(tx.trip.update).not.toHaveBeenCalled();
    expect(tx.day.deleteMany).not.toHaveBeenCalled();
  });

  it("answers 404 when there is no such trip or it is not the user's", async () => {
    lockItinerary.mockResolvedValue(false);

    const response = await patch(same);

    expect(response.status).toBe(404);
    expect(tx.trip.update).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await patch("{not json");

    expect(response.status).toBe(400);
    expect(lockItinerary).not.toHaveBeenCalled();
  });

  it("answers what the guard says and changes nothing without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await patch(same);

    expect(response.status).toBe(401);
    expect(lockItinerary).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lockItinerary.mockRejectedValue(new Error("down"));

    const response = await patch(same);

    expect(response.status).toBe(500);
  });
});
