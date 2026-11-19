import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  placeFindUnique,
  reviewFindUnique,
  reviewCreate,
  transaction,
  requireUser,
  refreshPlaceStats,
  markPlaceVisited,
} = vi.hoisted(() => ({
  placeFindUnique: vi.fn(),
  reviewFindUnique: vi.fn(),
  reviewCreate: vi.fn(),
  transaction: vi.fn(),
  requireUser: vi.fn(),
  refreshPlaceStats: vi.fn(),
  markPlaceVisited: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { findUnique: placeFindUnique },
    review: { findUnique: reviewFindUnique },
    $transaction: transaction,
  },
}));
vi.mock("@/lib/guard", () => ({ requireUser }));
vi.mock("@/lib/place-stats", () => ({ refreshPlaceStats, markPlaceVisited }));

import { POST } from "./route";

const tx = { review: { create: reviewCreate } };

const GOOD = { placeId: "p1", rating: 4, text: "Nice", priceLevel: "€€" };

function call(body: unknown) {
  return POST(
    new Request("http://x/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/reviews", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
    placeFindUnique.mockResolvedValue({ id: "p1", priceLevel: null });
    reviewFindUnique.mockResolvedValue(null);
    reviewCreate.mockResolvedValue({
      id: "r1",
      userId: "u1",
      placeId: "p1",
      rating: 4,
      text: "Nice",
      priceLevel: "€€",
      user: { id: "u1", username: "ana" },
    });
    refreshPlaceStats.mockResolvedValue({
      id: "p1",
      averageRating: 4,
      reviewCount: 1,
      priceLevel: "€€",
    });
    transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("saves the review, marks the place visited and refreshes its statistics, in one transaction", async () => {
    const response = await call(GOOD);

    expect(response.status).toBe(201);

    expect(reviewCreate).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        placeId: "p1",
        rating: 4,
        text: "Nice",
        priceLevel: "€€",
      },
      include: { user: { select: { id: true, username: true } } },
    });

    // The two policies of ADR-010 get the client of the transaction, not the global one
    expect(markPlaceVisited).toHaveBeenCalledWith(tx, "u1", "p1");
    expect(refreshPlaceStats).toHaveBeenCalledWith(tx, "p1");
    expect(transaction).toHaveBeenCalledTimes(1);

    const created = reviewCreate.mock.invocationCallOrder[0];
    const visited = markPlaceVisited.mock.invocationCallOrder[0];
    const refreshed = refreshPlaceStats.mock.invocationCallOrder[0];
    expect(created).toBeLessThan(visited);
    expect(visited).toBeLessThan(refreshed);

    const body = await response.json();
    expect(body.review.id).toBe("r1");
    expect(body.place).toMatchObject({ averageRating: 4, reviewCount: 1 });
  });

  it("answers 401 without a login and does nothing", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await call(GOOD);

    expect(response.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
    expect(placeFindUnique).not.toHaveBeenCalled();
  });

  it("answers 400 with one message per wrong field and saves nothing", async () => {
    const response = await call({ placeId: "p1", rating: 9, text: " " });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(Object.keys(body.errors).sort()).toEqual([
      "priceLevel",
      "rating",
      "text",
    ]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const response = await call("{not json");

    expect(response.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("answers 404 for a place that does not exist and has no data to be saved from", async () => {
    placeFindUnique.mockResolvedValue(null);

    const response = await call(GOOD);

    expect(response.status).toBe(404);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("puts the review on the place of the catalog that has the same OpenStreetMap id", async () => {
    placeFindUnique
      .mockResolvedValueOnce(null) // by id
      .mockResolvedValueOnce({ id: "p9", priceLevel: null }); // by osmId
    reviewCreate.mockResolvedValue({ id: "r9", placeId: "p9" });
    refreshPlaceStats.mockResolvedValue({ id: "p9", reviewCount: 1 });

    const response = await call({ ...GOOD, placeId: "osm-node-4242" });

    expect(response.status).toBe(201);
    expect(placeFindUnique).toHaveBeenNthCalledWith(2, {
      where: { osmId: "node/4242" },
    });
    expect(reviewCreate.mock.calls[0][0].data.placeId).toBe("p9");
    expect(refreshPlaceStats).toHaveBeenCalledWith(tx, "p9");
  });

  it("answers 409 when the user already reviewed the place, before saving anything", async () => {
    reviewFindUnique.mockResolvedValue({ id: "old" });

    const response = await call(GOOD);

    expect(response.status).toBe(409);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("answers 409 when the database refuses a second review of the same user at the same moment", async () => {
    transaction.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["userId", "placeId"] },
      })
    );

    const response = await call(GOOD);

    expect(response.status).toBe(409);
  });

  it("answers 500 when the statistics cannot be refreshed, and the review is not kept by the route", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // The failure is thrown inside the transaction, so the database undoes the review too.
    refreshPlaceStats.mockRejectedValue(new Error("down"));

    const response = await call(GOOD);

    expect(response.status).toBe(500);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
