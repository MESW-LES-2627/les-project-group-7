import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { refreshPlaceStats, markPlaceVisited } from "./place-stats";

const findUniqueOrThrow = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const upsert = vi.fn();
const queryRaw = vi.fn();

const db = {
  place: { findUniqueOrThrow, update },
  review: { findMany },
  visit: { upsert },
  $queryRaw: queryRaw,
} as unknown as PrismaClient;

describe("refreshPlaceStats", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    findUniqueOrThrow.mockResolvedValue({ priceLevel: null });
    update.mockImplementation(async ({ data }) => ({
      id: "p1",
      ...data,
    }));
  });

  it("recalculates average rating, review count and price level", async () => {
    findMany.mockResolvedValue([
      { rating: 4, priceLevel: "€" },
      { rating: 5, priceLevel: "€€" },
      { rating: 3, priceLevel: "€" },
    ]);

    const result = await refreshPlaceStats(db, "p1");

    expect(findMany).toHaveBeenCalledWith({
      where: { placeId: "p1" },
      select: { rating: true, priceLevel: true },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        averageRating: 4,
        reviewCount: 3,
        priceLevel: "€",
      },
    });

    expect(result.reviewCount).toBe(3);
  });

  it("handles a place without reviews", async () => {
    findMany.mockResolvedValue([]);

    await refreshPlaceStats(db, "p1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        averageRating: null,
        reviewCount: 0,
        priceLevel: null,
      },
    });
  });

  it("locks the row of the place before it reads the reviews, so parallel changes run one after the other", async () => {
    findMany.mockResolvedValue([{ rating: 5, priceLevel: "€" }]);

    await refreshPlaceStats(db, "p1");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [strings, placeId] = queryRaw.mock.calls[0];
    expect(strings.join("?")).toMatch(
      /FROM "Place" WHERE "id" = \? FOR NO KEY UPDATE/
    );
    expect(placeId).toBe("p1");

    // The lock comes first: a second change waits here and then reads what the first one saved
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      findMany.mock.invocationCallOrder[0]
    );
    expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0]
    );
  });

  it("keeps a FREE place free with only one paid review", async () => {
    findUniqueOrThrow.mockResolvedValue({ priceLevel: "FREE" });
    findMany.mockResolvedValue([{ rating: 5, priceLevel: "€€" }]);

    await refreshPlaceStats(db, "p1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        averageRating: 5,
        reviewCount: 1,
        priceLevel: "FREE",
      },
    });
  });

  it("updates a FREE place after two paid reviews", async () => {
    findUniqueOrThrow.mockResolvedValue({ priceLevel: "FREE" });
    findMany.mockResolvedValue([
      { rating: 4, priceLevel: "€€" },
      { rating: 5, priceLevel: "€€" },
    ]);

    await refreshPlaceStats(db, "p1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        averageRating: 4.5,
        reviewCount: 2,
        priceLevel: "€€",
      },
    });
  });

  it("clears rating and price when the last review is deleted (AC3)", async () => {
    // The place previously had a paid price from its reviews.
    findUniqueOrThrow.mockResolvedValue({ priceLevel: "€€" });

    // After deleting the last review, no reviews remain.
    findMany.mockResolvedValue([]);

    await refreshPlaceStats(db, "p1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        averageRating: null,
        reviewCount: 0,
        priceLevel: null,
      },
    });
  });
});

describe("markPlaceVisited", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates or updates the user's visit", async () => {
    upsert.mockResolvedValue({
      userId: "u1",
      placeId: "p1",
    });

    await markPlaceVisited(db, "u1", "p1");

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_placeId: {
          userId: "u1",
          placeId: "p1",
        },
      },
      update: {
        visitedAt: expect.any(Date),
      },
      create: {
        userId: "u1",
        placeId: "p1",
      },
    });
  });

  it("preserves an existing visit date when requested by the seed", async () => {
    upsert.mockResolvedValue({
      userId: "u1",
      placeId: "p1",
    });

    await markPlaceVisited(db, "u1", "p1", true);

    expect(upsert).toHaveBeenCalledWith({
      where: {
        userId_placeId: {
          userId: "u1",
          placeId: "p1",
        },
      },
      update: {},
      create: {
        userId: "u1",
        placeId: "p1",
      },
    });
  });
});
