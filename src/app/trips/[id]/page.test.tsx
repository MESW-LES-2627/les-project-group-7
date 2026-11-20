import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findFirst, findStops, findPlaces, getSession } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findStops: vi.fn(),
  findPlaces: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findFirst },
    itineraryStop: { findMany: findStops },
    place: { findMany: findPlaces },
  },
}));
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

function mockStop(id: string, dayId: string, position: number, name: string) {
  return {
    id,
    dayId,
    placeId: `p-${id}`,
    position,
    visitTime: position === 1 ? "10:00" : null,
    place: {
      id: `p-${id}`,
      name,
      category: "MUSEUM",
      address: "Rua 1",
      latitude: 41.1,
      longitude: -8.6,
      priceLevel: null,
    },
  };
}

beforeEach(() => {
  findFirst.mockReset();
  findStops.mockReset().mockResolvedValue([]);
  findPlaces.mockReset().mockResolvedValue([]);
  getSession.mockResolvedValue({ user: { id: "u1" } });
});

describe("TripPage", () => {
  it("shows Day 1, Day 2 and Day 3 with their dates, in order (AC2)", async () => {
    findFirst.mockResolvedValue(mockTrip());

    const html = await render();

    expect(html).toContain("Porto weekend");
    expect(html).toContain("Porto, Portugal");
    expect(html).toContain("Delete trip");
    expect(html).toContain("Edit trip");
    const tabs = [
      ...html.matchAll(/role="tab"[^>]*aria-label="(Day \d+), 0 places"/g),
    ];
    expect(tabs.map((match) => match[1])).toEqual(["Day 1", "Day 2", "Day 3"]);
    expect(html).toContain("Nothing planned for Tue 1 Dec 2026 yet.");
  });

  it("shows the stops of each day in order, with their times, and reads only the itinerary of the trip (#61)", async () => {
    findFirst.mockResolvedValue(mockTrip());
    findStops.mockResolvedValue([
      mockStop("s1", "d2", 1, "Serralves"),
      mockStop("s2", "d2", 2, "Casa da Música"),
    ]);

    const html = await render();

    expect(html.indexOf("Serralves")).toBeLessThan(
      html.indexOf("Casa da Música")
    );
    expect(html).toContain('value="10:00"');
    expect(html).toContain("Remove Serralves");
    expect(html).toContain("Save trip");
    expect(html).toContain("All changes saved");
    // the page opens on the first day that has stops, Day 2 here
    expect(html).toContain("Wed 2 Dec 2026");
    expect(html).toContain('aria-label="Day 2, 2 places"');
    expect(findStops).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itineraryId: "i1" } })
    );
    expect(findPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cityId: "c1" } })
    );
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
