import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

import MyPlacesPage from "./page";

beforeEach(() => {
  getSession.mockReset();
});

describe("MyPlacesPage", () => {
  it("sends a visitor who is not logged in to the login page", async () => {
    getSession.mockResolvedValue(null);

    await expect(MyPlacesPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("shows the page and starts loading the saved places when logged in", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });

    const html = renderToStaticMarkup(await MyPlacesPage());

    // Named "Saved" in #187, the word of the save buttons and of the planner's Saved tab
    expect(html).toMatch(/<h1[^>]*>Saved<\/h1>/);
    expect(html).toContain("Loading your saved places");
  });
});
