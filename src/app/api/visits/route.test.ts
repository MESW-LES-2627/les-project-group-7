import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, requireUser } = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: { findMany },
  },
}));

vi.mock("@/lib/guard", () => ({
  requireUser,
}));

import { GET } from "./route";

function call() {
  return GET(
    new Request("http://localhost/api/visits", {
      method: "GET",
    })
  );
}

function mockVisit(
  placeId: string,
  visitedAt: string,
  rating: number | null = 4
) {
  return {
    visitedAt: new Date(visitedAt),
    place: {
      id: placeId,
      name: `Place ${placeId}`,
      category: "MUSEUM",
      address: "Porto, Portugal",
      city: {
        name: "Porto",
        country: "Portugal",
      },
      reviews: rating === null ? [] : [{ rating }],
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  requireUser.mockResolvedValue({
    ok: true,
    user: { id: "user-1" },
  });
});

describe("GET /api/visits (Task #43)", () => {
  it("returns 401 when the user is not authenticated", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    });

    const response = await call();

    expect(response.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries only visits belonging to the authenticated user", async () => {
    findMany.mockResolvedValue([]);

    const response = await call();

    expect(response.status).toBe(200);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
      },
      select: {
        visitedAt: true,
        place: {
          select: {
            id: true,
            name: true,
            category: true,
            address: true,
            city: {
              select: {
                name: true,
                country: true,
              },
            },
            reviews: {
              where: { userId: "user-1" },
              select: {
                rating: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ visitedAt: "desc" }, { placeId: "asc" }],
    });
  });

  it("returns visited places with dates and the user's ratings", async () => {
    findMany.mockResolvedValue([
      mockVisit("p2", "2026-11-18T12:00:00.000Z", 5),
      mockVisit("p1", "2026-11-15T10:00:00.000Z", 3),
    ]);

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);

    expect(body[0]).toEqual({
      placeId: "p2",
      name: "Place p2",
      category: "MUSEUM",
      address: "Porto, Portugal",
      city: {
        name: "Porto",
        country: "Portugal",
      },
      visitedAt: "2026-11-18T12:00:00.000Z",
      rating: 5,
    });

    expect(body[1].placeId).toBe("p1");
    expect(body[1].rating).toBe(3);
  });

  it("returns null rating when a visit has no review", async () => {
    findMany.mockResolvedValue([
      mockVisit("p1", "2026-11-15T10:00:00.000Z", null),
    ]);

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].placeId).toBe("p1");
    expect(body[0].rating).toBeNull();
  });

  it("returns an empty array when the user has no visits", async () => {
    findMany.mockResolvedValue([]);

    const response = await call();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns 500 when the database query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    findMany.mockRejectedValue(new Error("Database failure"));

    try {
      const response = await call();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: "Failed to fetch visited places",
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
