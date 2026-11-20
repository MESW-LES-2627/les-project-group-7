import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findMany, getSession, redirect } = vi.hoisted(() => ({
  findMany: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: { findMany },
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

async function renderPage() {
  const jsx = await VisitedPage();
  return renderToStaticMarkup(jsx);
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
});

describe("Visited places page (Task #43)", () => {
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

    expect(html).toContain("No visited places yet");
    expect(html).toContain("Explore places");
    expect(html).toContain('href="/"');
  });

  it("shows visited places with ratings, dates and links to their details", async () => {
    findMany.mockResolvedValue([
      mockVisit("p2", "Serralves Museum", "2026-11-18T12:00:00.000Z", 5),
      mockVisit("p1", "Livraria Lello", "2026-11-15T10:00:00.000Z", 3),
    ]);

    const html = await renderPage();

    expect(html).toContain("My visited places");
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
