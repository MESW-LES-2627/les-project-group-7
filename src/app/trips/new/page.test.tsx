import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { findMany, getSession } = vi.hoisted(() => ({
  findMany: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { city: { findMany } } }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

import NewTripPage from "./page";

const render = async () => renderToStaticMarkup(await NewTripPage());

beforeEach(() => {
  findMany.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" } });
});

describe("NewTripPage", () => {
  it("shows the form with the cities", async () => {
    findMany.mockResolvedValue([
      { id: "c1", name: "Porto", country: "Portugal" },
    ]);

    const html = await render();

    expect(html).toContain("Porto, Portugal");
    expect(html).toContain('name="startDate"');
  });

  it("says why there is no form when there are no cities", async () => {
    findMany.mockResolvedValue([]);

    const html = await render();

    expect(html).toContain("No cities are available yet");
    expect(html).not.toContain("<form");
  });

  it("sends a person who is not logged in to the login page", async () => {
    getSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(findMany).not.toHaveBeenCalled();
  });
});
