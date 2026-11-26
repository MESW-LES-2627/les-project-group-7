import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, update, requireUser, lockItinerary, tx } = vi.hoisted(() => {
  const update = vi.fn();
  return {
    findFirst: vi.fn(),
    update,
    requireUser: vi.fn(),
    lockItinerary: vi.fn(),
    tx: { itinerary: { update } },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itinerary: { findFirst },
    $transaction: (run: (t: typeof tx) => unknown) => run(tx),
  },
}));
vi.mock("@/lib/guard", () => ({ requireUser }));
vi.mock("@/lib/trip-stops", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/trip-stops")>()),
  lockItinerary,
}));

import { GET, PUT } from "./route";

const params = (id = "t1") => ({ params: Promise.resolve({ id }) });

function get(id = "t1") {
  return GET(new Request(`http://x/api/trips/${id}/itinerary`), params(id));
}

function put(body: unknown, id = "t1") {
  return PUT(
    new Request(`http://x/api/trips/${id}/itinerary`, {
      method: "PUT",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params(id)
  );
}

const loggedOut = {
  ok: false,
  response: Response.json({ error: "Log in to do this" }, { status: 401 }),
};

const settings = { budgetLevel: "€€", dayStart: "09:00", dayEnd: "20:00" };
const empty = { budgetLevel: null, dayStart: null, dayEnd: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  lockItinerary.mockResolvedValue(true);
  update.mockImplementation(async ({ data }) => data);
});

describe("GET /api/trips/[id]/itinerary", () => {
  it("answers the settings of the itinerary of a trip of the user", async () => {
    findFirst.mockResolvedValue(settings);

    const response = await get("t1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(settings);
    // The owner is in the filter, so the trip of another user is never read
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { trip: { id: "t1", userId: "u1" } } })
    );
  });

  it("answers empty settings as null", async () => {
    findFirst.mockResolvedValue(empty);

    expect(await (await get()).json()).toEqual(empty);
  });

  it("answers 404 when there is no such trip or it is not the user's", async () => {
    findFirst.mockResolvedValue(null);

    expect((await get("other")).status).toBe(404);
  });

  it("answers what the guard says without a login", async () => {
    requireUser.mockResolvedValue(loggedOut);

    expect((await get()).status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findFirst.mockRejectedValue(new Error("down"));

    expect((await get()).status).toBe(500);
  });
});

describe("PUT /api/trips/[id]/itinerary", () => {
  it("saves the three settings and answers them (AC9)", async () => {
    const response = await put(settings);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(settings);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tripId: "t1" }, data: settings })
    );
  });

  it("clears the settings with null or an empty text (AC9)", async () => {
    await put({ budgetLevel: null, dayStart: "", dayEnd: null });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: empty })
    );
  });

  it("takes the lock of the itinerary before it writes", async () => {
    await put(settings);

    expect(lockItinerary).toHaveBeenCalledWith(tx, "t1", "u1");
    expect(lockItinerary.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0]
    );
  });

  it("answers 400 with one message for each wrong setting and saves nothing (AC10)", async () => {
    const response = await put({
      budgetLevel: "FREE",
      dayStart: "20:00",
      dayEnd: "09:00",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(Object.keys(body.errors).sort()).toEqual(["budgetLevel", "dayEnd"]);
    expect(body.error).toBe(body.errors.budgetLevel);
    expect(lockItinerary).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 when a setting is missing, so that it is not cleared by accident", async () => {
    const response = await put({ budgetLevel: "€" });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not a JSON object", async () => {
    expect((await put("{not json")).status).toBe(400);
    expect((await put(["€", null, null])).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("answers 404 when there is no such trip or it is not the user's", async () => {
    lockItinerary.mockResolvedValue(false);

    const response = await put(settings, "other");

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("answers what the guard says without a login and saves nothing", async () => {
    requireUser.mockResolvedValue(loggedOut);

    expect((await put(settings)).status).toBe(401);
    expect(lockItinerary).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lockItinerary.mockRejectedValue(new Error("down"));

    expect((await put(settings)).status).toBe(500);
  });
});
