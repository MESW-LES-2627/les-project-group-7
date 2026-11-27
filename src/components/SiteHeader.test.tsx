import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

import SiteHeader from "./SiteHeader";

const render = async () => renderToStaticMarkup(await SiteHeader());

beforeEach(() => {
  getSession.mockReset();
});

describe("SiteHeader", () => {
  it("renders log in and register links when logged out", async () => {
    getSession.mockResolvedValue(null);

    const html = await render();
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
    expect(html).not.toContain('href="/trips"');
    expect(html).not.toContain("My trips");
    expect(html).not.toContain('href="/my-places"');
  });

  it("renders the Saved link, to the saved places, when logged in", async () => {
    getSession.mockResolvedValue({
      user: { username: "maria", displayUsername: "Maria" },
    });

    const html = await render();
    expect(html).toMatch(/href="\/my-places"[^>]*>Saved<\/a>/);
    expect(html).not.toContain("My places");
  });

  it("renders My trips link and username when logged in", async () => {
    getSession.mockResolvedValue({
      user: { username: "maria", displayUsername: "Maria" },
    });

    const html = await render();
    expect(html).toContain('href="/trips"');
    expect(html).toContain("My trips");
    expect(html).toContain("@Maria");
    expect(html).not.toContain('href="/login"');
  });

  it("hides the username on a phone, for sight only, so the header fits 390 px", async () => {
    getSession.mockResolvedValue({
      user: { username: "maria", displayUsername: "Maria" },
    });

    const html = await render();
    expect(html).toMatch(/class="sr-only[^"]*sm:not-sr-only[^"]*">@Maria/);
  });

  it("keeps the My trips link readable on hover in dark mode", async () => {
    getSession.mockResolvedValue({
      user: { username: "maria", displayUsername: "Maria" },
    });

    const html = await render();

    // Indigo 600 is 2.8:1 on the dark background: dark mode hovers with indigo 400.
    expect(html).toContain("dark:hover:text-indigo-400");
  });
});

describe("History navigation (Task #43, renamed in #187)", () => {
  it("shows the three links together, My trips, Saved and History", async () => {
    getSession.mockResolvedValue({ user: { username: "maria" } });

    const html = await render();
    const links = [...html.matchAll(/href="(\/[a-z-]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(["/trips", "/my-places", "/visited"]);
  });

  it("shows History, the record of the places visited, when the user is logged in", async () => {
    getSession.mockResolvedValue({
      user: {
        id: "user-1",
        username: "maria",
        displayUsername: "Maria",
      },
    });

    const html = await render();

    expect(html).toMatch(/href="\/visited"[^>]*>History<\/a>/);
    expect(html).not.toContain("My visited places");
    expect(html).toContain("My trips");
  });

  it("hides History when the user is logged out", async () => {
    getSession.mockResolvedValue(null);

    const html = await render();

    expect(html).not.toContain(">History<");
    expect(html).not.toContain('href="/visited"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/register"');
  });
});
