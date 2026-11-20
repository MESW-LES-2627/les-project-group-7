import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findMany, findManyCity, getSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findManyCity: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findMany },
    city: { findMany: findManyCity },
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

import MyTripsPage from "./page";

const render = async () => renderToStaticMarkup(await MyTripsPage());

beforeEach(() => {
  findMany.mockReset();
  findManyCity.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" } });
  findManyCity.mockResolvedValue([
    { id: "c1", name: "Paris", country: "France" },
  ]);
});

describe("MyTripsPage (AC6)", () => {
  it("renders the list of trips belonging to the user", async () => {
    findMany.mockResolvedValue([
      {
        id: "trip-1",
        name: "Spring in Paris",
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-03T00:00:00Z"),
        createdAt: new Date("2026-11-14T10:00:00Z"),
        city: { id: "c1", name: "Paris", country: "France" },
        days: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
      },
    ]);

    const html = await render();

    expect(html).toContain("My trips");
    expect(html).toContain("Spring in Paris");
    expect(html).toContain("Paris, France");
    expect(html).toContain("1 Dec 2026 – 3 Dec 2026");
    expect(html).toContain("3 days");
    expect(html).toContain('href="/trips/trip-1"');

    // Scoped strictly to the logged-in user
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        orderBy: { startDate: "desc" },
      })
    );
  });

  it("renders empty state when the user has no trips", async () => {
    findMany.mockResolvedValue([]);

    const html = await render();

    expect(html).toContain("No trips yet");
    expect(html).toContain("You have not planned any trips yet");
  });

  it("has a single 'Plan a trip' button, the one in the header, also when there are no trips", async () => {
    findMany.mockResolvedValue([]);

    const html = await render();

    expect(html.match(/Plan a trip/g)).toHaveLength(1);
  });

  it("keeps the title of a card readable on hover in dark mode, and lets a long name wrap", async () => {
    // Indigo 600 is 2.8:1 on the dark background, so dark mode hovers with indigo 400. A name that is
    // one long word has to break, or the card pushes the page wider than a phone.
    findMany.mockResolvedValue([
      {
        id: "trip-1",
        name: "x".repeat(99),
        startDate: new Date("2026-12-01T00:00:00Z"),
        endDate: new Date("2026-12-03T00:00:00Z"),
        createdAt: new Date("2026-11-14T10:00:00Z"),
        city: { id: "c1", name: "Paris", country: "France" },
        days: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
      },
    ]);

    const html = await render();

    expect(html).toContain("dark:group-hover:text-indigo-400");
    expect(html).toContain("break-words");
    expect(html).toContain('class="min-w-0"');
  });

  it("redirects unauthenticated users to /login", async () => {
    getSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(findMany).not.toHaveBeenCalled();
  });
});
