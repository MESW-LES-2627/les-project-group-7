import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findMany, findCities, getSession, redirect } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findCities: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: { findMany },
    city: { findMany: findCities },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirect(path);
    throw new Error("NEXT_REDIRECT");
  },
}));

import VisitedPage from "./page";

function mockVisit(
  placeId: string,
  name: string,
  visitedAt: string,
  rating: number | null = 4
) {
  return {
    placeId,
    visitedAt: new Date(visitedAt),
    place: {
      id: placeId,
      name,
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

async function renderPage(
  params: { [key: string]: string | string[] | undefined } = {}
) {
  const jsx = await VisitedPage({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(jsx);
}

/** The address of the city button marked as the chosen one. */
const chosenCity = (html: string) =>
  html.match(/<a aria-current="page"[^>]*href="([^"]*)"/)?.[1];

/** The rows of prisma.city.findMany: each city with the number of the person's places in it. */
function cityRows(counts: Record<string, number>) {
  return Object.entries(counts).map(([name, places]) => ({
    id: `city-${name.toLowerCase()}`,
    name,
    _count: { places },
  }));
}

beforeEach(() => {
  vi.resetAllMocks();

  getSession.mockResolvedValue({
    user: {
      id: "user-1",
      username: "ana",
    },
  });

  findMany.mockResolvedValue([]);
  findCities.mockResolvedValue([]);
});

describe("History page, the places visited (Task #43, renamed in #187)", () => {
  it("redirects unauthenticated users to login", async () => {
    getSession.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries only the authenticated user's visits, newest first", async () => {
    await renderPage();

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      skip: 0,
      take: 24,
      select: {
        placeId: true,
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
              select: { rating: true },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ visitedAt: "desc" }, { placeId: "asc" }],
    });
  });

  it("shows an empty-state message and a link to explore places", async () => {
    const html = await renderPage();

    expect(html).toContain("Nothing in your history yet");
    // It says how a place gets here (#187, AC2)
    expect(html).toContain(
      "A place appears here when you post a review of it."
    );
    expect(html).toContain("Explore places");
    expect(html).toContain('href="/"');
  });

  it("shows visited places with ratings, dates and links to their details", async () => {
    findMany.mockResolvedValue([
      mockVisit("p2", "Serralves Museum", "2026-11-18T12:00:00.000Z", 5),
      mockVisit("p1", "Livraria Lello", "2026-11-15T10:00:00.000Z", 3),
    ]);

    const html = await renderPage();

    expect(html).toMatch(/<h1[^>]*>History<\/h1>/);
    expect(html).toContain("Serralves Museum");
    expect(html).toContain("Livraria Lello");
    expect(html).toContain("5/5");
    expect(html).toContain("3/5");
    expect(html).toContain("18 Nov 2026");
    expect(html).toContain("15 Nov 2026");
    expect(html).toContain('href="/places/p2"');
    expect(html).toContain('href="/places/p1"');

    expect(html.indexOf("Serralves Museum")).toBeLessThan(
      html.indexOf("Livraria Lello")
    );
  });

  it("shows Not rated when a visited place no longer has a review", async () => {
    findMany.mockResolvedValue([
      mockVisit("p1", "Livraria Lello", "2026-11-15T10:00:00.000Z", null),
    ]);

    const html = await renderPage();

    expect(html).toContain("Livraria Lello");
    expect(html).toContain("Not rated");
    expect(html).toContain('href="/places/p1"');
  });
});

describe("History: the filter by city (#187)", () => {
  beforeEach(() => {
    findCities.mockResolvedValue(
      cityRows({ Porto: 84, Paris: 68, Berlin: 65, Lisboa: 0 })
    );
  });

  it("counts only the person's places in each city", async () => {
    await renderPage();

    expect(findCities).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            places: { where: { visits: { some: { userId: "user-1" } } } },
          },
        },
      },
    });
  });

  it("shows All cities and each city with places of the person, with its count, as links", async () => {
    const html = await renderPage();

    expect(html).toContain('aria-label="Filter by city"');
    expect(html).toMatch(/href="\/visited"[^>]*>All cities<span[^>]*>217</);
    expect(html).toMatch(
      /href="\/visited\?city=city-berlin"[^>]*>Berlin<span[^>]*>65</
    );
    expect(html).toMatch(
      /href="\/visited\?city=city-porto"[^>]*>Porto<span[^>]*>84</
    );
    expect(html).not.toContain("Lisboa");
    expect(html.indexOf(">Berlin<")).toBeLessThan(html.indexOf(">Paris<"));
  });

  it("marks the chosen city and asks only for its places", async () => {
    const html = await renderPage({ city: "city-paris" });

    expect(chosenCity(html)).toBe("/visited?city=city-paris");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", place: { cityId: "city-paris" } },
      })
    );
  });

  it("shows all cities for a city that is not one of the person's", async () => {
    const html = await renderPage({ city: "city-lisboa" });

    expect(chosenCity(html)).toBe("/visited");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("shows no filter when all the places are in one city", async () => {
    findCities.mockResolvedValue(cityRows({ Porto: 12, Paris: 0 }));

    expect(await renderPage()).not.toContain("Filter by city");
  });
});

describe("History: the pages (#187)", () => {
  beforeEach(() => {
    findCities.mockResolvedValue(
      cityRows({ Porto: 84, Paris: 68, Berlin: 65 })
    );
    findMany.mockResolvedValue([
      mockVisit("p1", "Livraria Lello", "2026-11-15T10:00:00.000Z"),
    ]);
  });

  it("asks only for the places of the page", async () => {
    await renderPage({ page: "3" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 48, take: 24 })
    );
  });

  it("says which places are shown and links to the page before and after", async () => {
    const html = await renderPage({ page: "2" });

    expect(html).toContain("Showing 25 to 48 of 217 places");
    expect(html).toContain("Page 2 of 10");
    expect(html).toMatch(/href="\/visited"[^>]*>.*Previous</);
    expect(html).toMatch(/href="\/visited\?page=3"[^>]*>Next/);
  });

  it("keeps the city in the links of the pages", async () => {
    const html = await renderPage({ city: "city-paris", page: "2" });

    expect(html).toContain("Showing 25 to 48 of 68 places");
    expect(html).toMatch(/href="\/visited\?city=city-paris"[^>]*>.*Previous</);
    expect(html).toMatch(
      /href="\/visited\?city=city-paris&amp;page=3"[^>]*>Next/
    );
  });

  it("greys out Previous on the first page and Next on the last, without a link", async () => {
    const first = await renderPage();
    expect(first).toMatch(/<span aria-disabled="true"[^>]*>.*Previous<\/span>/);
    expect(first).toMatch(/href="\/visited\?page=2"[^>]*>Next/);

    const last = await renderPage({ page: "10" });
    expect(last).toContain("Showing 217 to 217 of 217 places");
    expect(last).toMatch(/<span aria-disabled="true"[^>]*>Next/);
  });

  it("goes to the last page for a page number that is too big", async () => {
    const html = await renderPage({ page: "99" });

    expect(html).toContain("Page 10 of 10");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 216 })
    );
  });

  it("shows no page controls with 24 places or fewer", async () => {
    findCities.mockResolvedValue(cityRows({ Porto: 20, Paris: 4 }));

    const html = await renderPage();

    expect(html).not.toContain("Showing");
    expect(html).not.toContain("Next");
  });
});

describe("History: where each place is (#187)", () => {
  it("says the city once, with the country, when the address already ends with it", async () => {
    findMany.mockResolvedValue([
      {
        ...mockVisit("p1", "Rivoli 59", "2026-11-15T10:00:00.000Z"),
        place: {
          ...mockVisit("p1", "Rivoli 59", "2026-11-15T10:00:00.000Z").place,
          address: "Rue de Rivoli, 75001, Paris",
          city: { name: "Paris", country: "France" },
        },
      },
    ]);

    const html = await renderPage();

    expect(html).toContain("Rue de Rivoli, 75001, Paris, France");
    expect(html).not.toContain("Paris — Paris");
  });
});
