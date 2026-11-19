import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findUnique, findVisit, getSession } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findVisit: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { findUnique },
    visit: { findUnique: findVisit },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import PlacePage from "./page";
import NotFound from "./not-found";

interface MockPlaceOverrides {
  id?: string;
  name?: string;
  category?: string;
  address?: string;
  description?: string | null;
  priceLevel?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  city?: { name: string; country: string };
  reviews?: Array<Record<string, unknown>>;
}

function mockPlace(overrides: MockPlaceOverrides = {}) {
  return {
    id: "p1",
    name: "Livraria Lello",
    category: "MONUMENT",
    address: "Rua das Carmelitas 144, Porto",
    description: "Neo-gothic bookshop.",
    priceLevel: "€",
    averageRating: 4.25,
    reviewCount: 2,
    openingHours: null,
    city: { name: "Porto", country: "Portugal" },
    reviews: [],
    ...overrides,
  };
}

function review(id: string, iso: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    rating: 4,
    priceLevel: "€",
    text: "Lovely.",
    createdAt: new Date(iso),
    user: { username: "ana", displayUsername: "Ana" },
    ...extra,
  };
}

async function renderPage(id = "p1"): Promise<string> {
  const jsx = await PlacePage({ params: Promise.resolve({ id }) });

  return renderToStaticMarkup(jsx);
}

beforeEach(() => {
  findUnique.mockReset();
  findVisit.mockReset();
  getSession.mockReset();

  getSession.mockResolvedValue(null);
  findVisit.mockResolvedValue(null);
});

describe("Place page details (AC1)", () => {
  it("shows name, type, address, description, rating, review count and price level", async () => {
    findUnique.mockResolvedValue(mockPlace());

    const html = await renderPage();

    expect(html).toContain("Livraria Lello");
    expect(html).toContain("Monument");
    expect(html).toContain("Rua das Carmelitas 144, Porto");
    expect(html).toContain("Neo-gothic bookshop.");
    expect(html).toContain("4.3");
    expect(html).toContain("2 reviews");
    expect(html).toContain("€");
  });

  it("shows Free for a fee=no place and Price unknown when there is no price", async () => {
    findUnique.mockResolvedValue(mockPlace({ priceLevel: "FREE" }));

    expect(await renderPage()).toContain("Free");

    findUnique.mockResolvedValue(mockPlace({ priceLevel: null }));

    expect(await renderPage()).toContain("Price unknown");
  });

  it("shows a placeholder when the place has no description", async () => {
    findUnique.mockResolvedValue(mockPlace({ description: null }));

    expect(await renderPage()).toContain("No description yet.");
  });

  it("asks the database for the id in the URL", async () => {
    findUnique.mockResolvedValue(mockPlace());

    await renderPage("abc");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "abc" } })
    );
  });
});

describe("Unknown place (AC5)", () => {
  it("shows the not-found page when the id does not exist", async () => {
    findUnique.mockResolvedValue(null);

    await expect(renderPage("does-not-exist")).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("shows the not-found page for an id that is not a catalog id", async () => {
    findUnique.mockResolvedValue(null);

    await expect(renderPage("node-123")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the not-found component with back link", () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain("Place not found");
    expect(html).toContain('href="/"');
  });
});

describe("Reviews of a place (AC3)", () => {
  it("lists reviews newest first with author, rating, price level and text", async () => {
    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [
          review("old", "2026-01-01", {
            text: "Old one.",
            user: { username: "rui", displayUsername: null },
          }),
          review("new", "2026-05-01", {
            text: "New one.",
            rating: 5,
            priceLevel: "€€",
          }),
        ],
      })
    );

    const html = await renderPage();

    expect(html.indexOf("New one.")).toBeLessThan(html.indexOf("Old one."));
    expect(html).toContain("Ana");
    expect(html).toContain("rui");
    expect(html).toContain("€€");
    expect(html).toContain('aria-label="Rated 5 out of 5"');
  });

  it("leaves out the price badge and text of a review that has none", async () => {
    findUnique.mockResolvedValue(
      mockPlace({
        priceLevel: "€",
        reviews: [review("r1", "2026-01-01", { priceLevel: null, text: "" })],
      })
    );

    const html = await renderPage();

    expect(html).not.toContain("Price unknown");
    expect(html).toContain("Ana");
  });
});

describe("Place without reviews (AC4)", () => {
  it("says there are no reviews yet and offers to write the first one", async () => {
    findUnique.mockResolvedValue(
      mockPlace({ reviews: [], reviewCount: 0, averageRating: null })
    );

    const html = await renderPage();

    expect(html).toContain("No reviews yet");
    expect(html).toContain("Write the first review");
  });

  it("offers a normal write button when there are reviews", async () => {
    findUnique.mockResolvedValue(
      mockPlace({ reviews: [review("r1", "2026-01-01")] })
    );

    const html = await renderPage();

    expect(html).toContain("Write a review");
    expect(html).not.toContain("Write the first review");
  });
});

describe("Review edit and delete controls (Task #41)", () => {
  it("shows Edit and Delete for the review owner", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", name: "Ana" },
    });

    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [
          review("r1", "2026-05-01", {
            userId: "user-1",
          }),
        ],
      })
    );

    const html = await renderPage();

    expect(html).toContain("Edit");
    expect(html).toContain("Delete");
  });

  it("hides Edit and Delete for another user's review", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-1", name: "Ana" },
    });

    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [
          review("r1", "2026-05-01", {
            userId: "user-2",
          }),
        ],
      })
    );

    const html = await renderPage();

    expect(html).not.toContain(">Edit</button>");
    expect(html).not.toContain(">Delete</button>");
  });

  it("hides Edit and Delete when the visitor is not logged in", async () => {
    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [
          review("r1", "2026-05-01", {
            userId: "user-1",
          }),
        ],
      })
    );

    const html = await renderPage();

    expect(html).not.toContain(">Edit</button>");
    expect(html).not.toContain(">Delete</button>");
  });
});
