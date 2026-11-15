import { describe, it, expect, vi, beforeEach } from "vitest";

const { deleteMany, requireUser } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { trip: { deleteMany } } }));
vi.mock("@/lib/guard", () => ({ requireUser }));

import { DELETE } from "./route";

function call(id = "t1") {
  return DELETE(new Request(`http://x/api/trips/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/trips/[id]", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
  });

  it("deletes a trip of the user and answers 204", async () => {
    deleteMany.mockResolvedValue({ count: 1 });

    const response = await call("t1");

    expect(response.status).toBe(204);

    // The owner is in the filter, so another user's trip can never match.
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "t1", userId: "u1" },
    });
  });

  it("answers 404 when there is no such trip or it is not the user's", async () => {
    deleteMany.mockResolvedValue({ count: 0 });

    const response = await call("other");

    expect(response.status).toBe(404);
  });

  it("answers what the guard says and deletes nothing without a login", async () => {
    requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await call();

    expect(response.status).toBe(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    deleteMany.mockRejectedValue(new Error("down"));

    const response = await call();

    expect(response.status).toBe(500);
  });
});
