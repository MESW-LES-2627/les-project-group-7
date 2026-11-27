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

async function renderPage(
  id = "p1",
  query: { [key: string]: string | string[] | undefined } = {}
): Promise<string> {
  const jsx = await PlacePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(query),
  });

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

describe("The review of the logged-in user comes first", () => {
  const reviews = () => [
    review("old", "2026-01-01", { text: "Oldest one.", userId: "u-old" }),
    review("mine", "2026-02-01", { text: "My own one.", userId: "user-1" }),
    review("new", "2026-05-01", { text: "Newest one.", userId: "u-new" }),
  ];

  it("shows the own review before the newer ones of other people", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", name: "Ana" } });
    findUnique.mockResolvedValue(mockPlace({ reviews: reviews() }));

    const html = await renderPage();

    expect(html.indexOf("My own one.")).toBeLessThan(
      html.indexOf("Newest one.")
    );
    expect(html.indexOf("Newest one.")).toBeLessThan(
      html.indexOf("Oldest one.")
    );
  });

  it("keeps newest first for a visitor who is not logged in", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: reviews() }));

    const html = await renderPage();

    expect(html.indexOf("Newest one.")).toBeLessThan(
      html.indexOf("My own one.")
    );
    expect(html.indexOf("My own one.")).toBeLessThan(
      html.indexOf("Oldest one.")
    );
  });

  it("keeps newest first for a logged-in user who has no review of the place", async () => {
    getSession.mockResolvedValue({ user: { id: "someone-else", name: "Rui" } });
    findUnique.mockResolvedValue(mockPlace({ reviews: reviews() }));

    const html = await renderPage();

    expect(html.indexOf("Newest one.")).toBeLessThan(
      html.indexOf("My own one.")
    );
  });
});

describe("One review per person: no write button for who already wrote one (#187)", () => {
  it("hides Write a review when the logged-in user has a review here; Edit is the way to change it", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", name: "Ana" } });
    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [
          review("r1", "2026-05-01", { userId: "user-1" }),
          review("r2", "2026-04-01", { userId: "user-2" }),
        ],
      })
    );

    const html = await renderPage();

    expect(html).not.toContain("Write a review");
    expect(html).toContain("Edit");
  });

  it("keeps Write a review for a logged-in user whose review is not here", async () => {
    getSession.mockResolvedValue({ user: { id: "user-1", name: "Ana" } });
    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [review("r2", "2026-04-01", { userId: "user-2" })],
      })
    );

    expect(await renderPage()).toContain("Write a review");
  });
});

describe("Where the place is (#187)", () => {
  it("says the city once, then the country, when the address already ends with it", async () => {
    findUnique.mockResolvedValue(mockPlace());

    const html = await renderPage();

    expect(html).toContain("Rua das Carmelitas 144, Porto, Portugal");
    expect(html).not.toContain("Porto, Porto");
  });
});

describe("Reviews of a place, 10 per page (#187)", () => {
  /** 25 reviews, "Review 01" the newest. */
  const many = (extra: (i: number) => Record<string, unknown> = () => ({})) =>
    Array.from({ length: 25 }, (_, i) =>
      review(`r${i}`, `2026-01-${String(28 - i).padStart(2, "0")}`, {
        text: `Review ${String(i + 1).padStart(2, "0")}`,
        userId: `user-${i}`,
        ...extra(i),
      })
    );
  const shown = (html: string) => html.match(/Review \d\d/g);

  it("shows the first 10 and links to the next page, at the reviews", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: many() }));

    const html = await renderPage();

    expect(shown(html)).toHaveLength(10);
    expect(shown(html)![0]).toBe("Review 01");
    expect(html).toContain("Showing 1 to 10 of 25 reviews");
    expect(html).toContain("Page 1 of 3");
    expect(html).toMatch(/href="\/places\/p1\?page=2#reviews"[^>]*>Next/);
    expect(html).toContain('id="reviews"');
  });

  it("shows the reviews of the page of the address", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: many() }));

    const html = await renderPage("p1", { page: "3" });

    expect(shown(html)).toEqual([
      "Review 21",
      "Review 22",
      "Review 23",
      "Review 24",
      "Review 25",
    ]);
    expect(html).toContain("Showing 21 to 25 of 25 reviews");
    expect(html).toMatch(/href="\/places\/p1\?page=2#reviews"[^>]*>.*Previous/);
  });

  it("links page 1 without a page number", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: many() }));

    const html = await renderPage("p1", { page: "2" });

    expect(html).toMatch(/href="\/places\/p1#reviews"[^>]*>.*Previous/);
  });

  it("keeps the person's own review first, on page 1", async () => {
    getSession.mockResolvedValue({ user: { id: "user-20", name: "Ana" } });
    findUnique.mockResolvedValue(mockPlace({ reviews: many() }));

    const html = await renderPage();

    expect(shown(html)![0]).toBe("Review 21");
  });

  it("goes to the last page for a page that does not exist, like after deleting the last review", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: many() }));

    const html = await renderPage("p1", { page: "9" });

    expect(html).toContain("Page 3 of 3");
  });

  it("shows no page controls with 10 reviews or fewer", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: many().slice(0, 10) }));

    const html = await renderPage();

    expect(shown(html)).toHaveLength(10);
    expect(html).not.toContain("Showing");
  });
});

describe("Reviews of a place, filtered by stars (#187)", () => {
  /** 6 reviews: three of 5 stars, two of 4 and one of 1, "Stars N" in their text. */
  const mixed = () =>
    [5, 4, 5, 1, 5, 4].map((rating, i) =>
      review(`r${i}`, `2026-01-${String(20 - i).padStart(2, "0")}`, {
        rating,
        text: `Stars ${rating} number ${i}`,
        userId: `user-${i}`,
      })
    );
  const texts = (html: string) => html.match(/Stars \d number \d/g) ?? [];

  it("shows all reviews by default, with a button for each rating that has reviews and its count", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: mixed() }));

    const html = await renderPage();

    expect(texts(html)).toHaveLength(6);
    expect(html).toContain('aria-label="Filter by stars"');
    expect(html).toMatch(
      /href="\/places\/p1#reviews"[^>]*>All reviews<span[^>]*>6</
    );
    expect(html).toMatch(
      /href="\/places\/p1\?stars=5#reviews"[^>]*>5 ★<span[^>]*>3</
    );
    expect(html).toMatch(
      /href="\/places\/p1\?stars=1#reviews"[^>]*>1 ★<span[^>]*>1</
    );
    expect(html).not.toContain("?stars=2");
  });

  it("shows only the reviews of the chosen rating", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: mixed() }));

    const html = await renderPage("p1", { stars: "4" });

    expect(texts(html)).toEqual(["Stars 4 number 1", "Stars 4 number 5"]);
    expect(html).toMatch(
      /<a aria-current="page"[^>]*href="\/places\/p1\?stars=4#reviews"/
    );
  });

  it("keeps the rating in the links of the pages, and counts only its reviews", async () => {
    const fives = Array.from({ length: 14 }, (_, i) =>
      review(`f${i}`, `2026-01-${String(28 - i).padStart(2, "0")}`, {
        rating: 5,
        userId: `u${i}`,
      })
    );
    findUnique.mockResolvedValue(
      mockPlace({ reviews: [...fives, ...mixed()] })
    );

    const html = await renderPage("p1", { stars: "5" });

    expect(html).toContain("Showing 1 to 10 of 17 reviews");
    expect(html).toMatch(
      /href="\/places\/p1\?stars=5&amp;page=2#reviews"[^>]*>Next/
    );
  });

  it("shows all reviews for a rating of the address that has none", async () => {
    findUnique.mockResolvedValue(mockPlace({ reviews: mixed() }));

    const html = await renderPage("p1", { stars: "2" });

    expect(texts(html)).toHaveLength(6);
  });

  it("shows no filter when every review has the same rating", async () => {
    findUnique.mockResolvedValue(
      mockPlace({
        reviews: [review("a", "2026-01-02"), review("b", "2026-01-01")],
      })
    );

    expect(await renderPage()).not.toContain("Filter by stars");
  });

  it("keeps the person's own review first when it has the chosen rating", async () => {
    getSession.mockResolvedValue({ user: { id: "user-4", name: "Ana" } });
    findUnique.mockResolvedValue(mockPlace({ reviews: mixed() }));

    const html = await renderPage("p1", { stars: "5" });

    expect(texts(html)[0]).toBe("Stars 5 number 4");
  });
});

describe("Review text on a wide screen (#187)", () => {
  it("wraps the text of a review at a reading width, while the page fills the screen", async () => {
    findUnique.mockResolvedValue(
      mockPlace({ reviews: [review("r1", "2026-01-01", { text: "Lovely." })] })
    );

    const html = await renderPage();

    expect(html).toMatch(/<p class="[^"]*max-w-prose[^"]*">Lovely\.<\/p>/);
  });
});
