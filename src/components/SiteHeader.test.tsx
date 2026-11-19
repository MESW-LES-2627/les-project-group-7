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

  it("renders the My places link when logged in", async () => {
    getSession.mockResolvedValue({
      user: { username: "maria", displayUsername: "Maria" },
    });

    const html = await render();
    expect(html).toContain('href="/my-places"');
    expect(html).toContain("My places");
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

  it("keeps the My trips link readable on hover in dark mode", async () => {
    getSession.mockResolvedValue({
      user: { username: "maria", displayUsername: "Maria" },
    });

    const html = await render();

    // Indigo 600 is 2.8:1 on the dark background: dark mode hovers with indigo 400.
    expect(html).toContain("dark:hover:text-indigo-400");
  });
});
