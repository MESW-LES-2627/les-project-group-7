import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  findFirst,
  update,
  deleteMany,
  transaction,
  requireUser,
  refreshPlaceStats,
} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  requireUser: vi.fn(),
  refreshPlaceStats: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    review: { findFirst },
    $transaction: transaction,
  },
}));

vi.mock("@/lib/guard", () => ({ requireUser }));

vi.mock("@/lib/place-stats", () => ({ refreshPlaceStats }));

import { PATCH, DELETE } from "./route";

const tx = {
  review: { findFirst, update, deleteMany },
};

function call(body: unknown, id = "r1") {
  return PATCH(
    new Request(`http://x/api/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("PATCH /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    requireUser.mockResolvedValue({
      ok: true,
      user: { id: "u1" },
    });

    findFirst.mockResolvedValue({ placeId: "p1" });

    update.mockResolvedValue({
      id: "r1",
      userId: "u1",
      placeId: "p1",
      rating: 5,
      text: "Great place",
      priceLevel: "€",
    });

    refreshPlaceStats.mockResolvedValue({
      id: "p1",
      averageRating: 5,
      reviewCount: 1,
      priceLevel: "€",
    });

    transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("updates a review belonging to the logged-in user", async () => {
    const response = await call({
      rating: 5,
      text: "Great place",
      priceLevel: "€",
    });

    expect(response.status).toBe(200);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "r1", userId: "u1" },
      select: { placeId: true },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "r1", userId: "u1" },
      data: {
        rating: 5,
        text: "Great place",
        priceLevel: "€",
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    expect(refreshPlaceStats).toHaveBeenCalledWith(tx, "p1");

    const data = await response.json();
    expect(data.review.rating).toBe(5);
    expect(data.place.averageRating).toBe(5);
  });

  it("returns 404 for a missing or another user's review", async () => {
    findFirst.mockResolvedValue(null);

    const response = await call({ rating: 4 }, "other");

    expect(response.status).toBe(404);
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 401 without authentication", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await call({ rating: 4 });

    expect(response.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid rating", async () => {
    const response = await call({ rating: 6 });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns one message for each wrong field, as the post does", async () => {
    const response = await call({ rating: 9, text: " ", priceLevel: "x" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Rating must be an integer between 1 and 5");
    expect(Object.keys(body.errors).sort()).toEqual([
      "priceLevel",
      "rating",
      "text",
    ]);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not allow changing review ownership", async () => {
    const response = await call({
      userId: "u2",
      rating: 5,
    });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 500 if the database update fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    update.mockRejectedValue(new Error("Database failure"));

    try {
      const response = await call({ rating: 4 });

      expect(response.status).toBe(500);
      expect(refreshPlaceStats).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

function callDelete(id = "r1") {
  return DELETE(
    new Request(`http://x/api/reviews/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("DELETE /api/reviews/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    requireUser.mockResolvedValue({
      ok: true,
      user: { id: "u1" },
    });

    findFirst.mockResolvedValue({ placeId: "p1" });
    deleteMany.mockResolvedValue({ count: 1 });
    refreshPlaceStats.mockResolvedValue({ id: "p1", reviewCount: 0 });

    transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("deletes the user's review and returns 204", async () => {
    const response = await callDelete();

    expect(response.status).toBe(204);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "r1", userId: "u1" },
      select: { placeId: true },
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "r1", userId: "u1" },
    });

    expect(refreshPlaceStats).toHaveBeenCalledWith(tx, "p1");
  });

  it("returns 404 for a missing or another user's review", async () => {
    findFirst.mockResolvedValue(null);

    const response = await callDelete("other");

    expect(response.status).toBe(404);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(refreshPlaceStats).not.toHaveBeenCalled();
  });

  it("returns 401 without authentication", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await callDelete();

    expect(response.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns 404 if the review disappears before deletion", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    const response = await callDelete();

    expect(response.status).toBe(404);
    expect(refreshPlaceStats).not.toHaveBeenCalled();
  });

  it("does not remove the visited-place record", async () => {
    const response = await callDelete();

    expect(response.status).toBe(204);

    // The DELETE handler must not delete or modify visits.
    expect(tx).not.toHaveProperty("visit");
    expect(refreshPlaceStats).toHaveBeenCalledWith(tx, "p1");
  });

  it("returns 500 when the database fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    deleteMany.mockRejectedValue(new Error("Database failure"));

    try {
      const response = await callDelete();

      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
