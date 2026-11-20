import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany, getSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { trip: { findMany } } }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

import { GET } from "./route";

function callGet() {
  return GET(new Request("http://localhost:3000/api/trips", { method: "GET" }));
}

beforeEach(() => {
  findMany.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" } });
});

describe("GET /api/trips", () => {
  it("returns 200 with the list of trips belonging to the user (AC6)", async () => {
    findMany.mockResolvedValue([
      {
        id: "t1",
        name: "Paris trip",
        city: { id: "c1", name: "Paris", country: "France" },
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-03T00:00:00Z"),
        createdAt: new Date("2026-11-14T10:00:00Z"),
        days: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
      },
    ]);

    const res = await callGet();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([
      {
        id: "t1",
        name: "Paris trip",
        city: { id: "c1", name: "Paris", country: "France" },
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        daysCount: 3,
        createdAt: "2026-11-14T10:00:00.000Z",
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      include: {
        city: { select: { id: true, name: true, country: true } },
        days: { select: { id: true } },
      },
      orderBy: { startDate: "desc" },
    });
  });

  it("returns 401 when the user is not logged in", async () => {
    getSession.mockResolvedValue(null);

    const res = await callGet();
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when database query fails", async () => {
    findMany.mockRejectedValue(new Error("DB failure"));

    const res = await callGet();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to list trips" });
  });
});
