import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findFirst, getSession } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { trip: { findFirst } } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

import TripPage from "./page";

function mockTrip() {
  const day = (n: number, date: string) => ({
    id: `d${n}`,
    dayNumber: n,
    date: new Date(`${date}T00:00:00Z`),
  });
  return {
    id: "t1",
    name: "Porto weekend",
    cityId: "c1",
    startDate: new Date("2026-12-01T00:00:00Z"),
    endDate: new Date("2026-12-03T00:00:00Z"),
    createdAt: new Date("2026-11-13T10:00:00Z"),
    days: [day(3, "2026-12-03"), day(1, "2026-12-01"), day(2, "2026-12-02")],
    itinerary: {
      id: "i1",
      mode: "MANUAL",
      budgetLevel: null,
      dayStart: null,
      dayEnd: null,
    },
    city: { name: "Porto", country: "Portugal" },
  };
}

const render = async (id = "t1") =>
  renderToStaticMarkup(await TripPage({ params: Promise.resolve({ id }) }));

beforeEach(() => {
  findFirst.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" } });
});

describe("TripPage", () => {
  it("shows Day 1, Day 2 and Day 3 with their dates, in order (AC2)", async () => {
    findFirst.mockResolvedValue(mockTrip());

    const html = await render();

    expect(html).toContain("Porto weekend");
    expect(html).toContain("Porto, Portugal");
    expect(html).toContain("Delete trip");
    expect(html.match(/Day \d+ — [^<]+/g)).toEqual([
      "Day 1 — Tue 1 Dec 2026",
      "Day 2 — Wed 2 Dec 2026",
      "Day 3 — Thu 3 Dec 2026",
    ]);
    expect(html.match(/No places yet/g)).toHaveLength(3);
  });

  it("only looks for a trip of the logged-in user, a 404 otherwise", async () => {
    findFirst.mockResolvedValue(null);

    await expect(render("t-of-someone-else")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-of-someone-else", userId: "u1" },
      })
    );
  });

  it("sends a person who is not logged in to the login page", async () => {
    getSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(findFirst).not.toHaveBeenCalled();
  });
});
