import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { findMany: vi.fn().mockResolvedValue([]) },
    city: { findMany: vi.fn().mockResolvedValue([]) },
    visit: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
// The map and the trip dialog are client parts with their own tests
vi.mock("@/components/PlaceExplorer", () => ({ default: () => null }));
vi.mock("@/components/CreateTripDialog", () => ({ default: () => null }));

import Home from "./page";

describe("Home page (#187, AC5)", () => {
  it("has one main heading for screen readers, hidden on the screen", async () => {
    const html = renderToStaticMarkup(await Home());

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="sr-only">Explore places</h1>');
  });
});
