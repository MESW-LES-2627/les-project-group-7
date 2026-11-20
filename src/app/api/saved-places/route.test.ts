import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, DELETE, GET } from "./route";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findPlace: vi.fn(),
  findSavedPlace: vi.fn(),
  findSavedPlaces: vi.fn(),
  createSavedPlace: vi.fn(),
  deleteSavedPlace: vi.fn(),
  deleteListEntries: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { findUnique: mocks.findPlace },
    $transaction: mocks.transaction,
    listEntry: { deleteMany: mocks.deleteListEntries },
    savedPlace: {
      findUnique: mocks.findSavedPlace,
      findMany: mocks.findSavedPlaces,
      create: mocks.createSavedPlace,
      deleteMany: mocks.deleteSavedPlace,
    },
  },
}));

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost:3000/api/saved-places", {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/saved-places", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.requireUser.mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
    });

    mocks.findPlace.mockResolvedValue({ id: "place-1" });
    mocks.findSavedPlace.mockResolvedValue(null);
    mocks.createSavedPlace.mockImplementation(async ({ data }) => ({
      id: "saved-1",
      savedAt: new Date(),
      ...data,
    }));
  });

  it("adds a place to the wishlist (AC1)", async () => {
    const response = await POST(
      makeRequest({ placeId: "place-1", type: "WISHLIST" })
    );

    expect(response.status).toBe(201);
    expect(mocks.createSavedPlace).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        placeId: "place-1",
        type: "WISHLIST",
      },
    });
  });

  it("adds a place to bookmarks (AC2)", async () => {
    const response = await POST(
      makeRequest({ placeId: "place-1", type: "BOOKMARK" })
    );

    expect(response.status).toBe(201);
    expect(mocks.createSavedPlace).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        placeId: "place-1",
        type: "BOOKMARK",
      },
    });
  });

  it("allows saving the same place in a different list (AC4)", async () => {
    mocks.findSavedPlace.mockResolvedValueOnce(null);
    mocks.findSavedPlace.mockResolvedValueOnce(null);

    const wishlist = await POST(
      makeRequest({ placeId: "place-1", type: "WISHLIST" })
    );

    const bookmark = await POST(
      makeRequest({ placeId: "place-1", type: "BOOKMARK" })
    );

    expect(wishlist.status).toBe(201);
    expect(bookmark.status).toBe(201);
    expect(mocks.createSavedPlace).toHaveBeenCalledTimes(2);
  });

  it("rejects duplicate entries in the same list", async () => {
    mocks.findSavedPlace.mockResolvedValue({ id: "saved-1" });

    const response = await POST(
      makeRequest({ placeId: "place-1", type: "WISHLIST" })
    );

    expect(response.status).toBe(409);
    expect(mocks.createSavedPlace).not.toHaveBeenCalled();
  });

  it("returns 404 when the place does not exist", async () => {
    mocks.findPlace.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ placeId: "missing-place", type: "WISHLIST" })
    );

    expect(response.status).toBe(404);
    expect(mocks.createSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    const response = await POST(makeRequest({ placeId: "", type: "INVALID" }));

    expect(response.status).toBe(400);
    expect(mocks.createSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied userId", async () => {
    const response = await POST(
      makeRequest({
        placeId: "place-1",
        type: "WISHLIST",
        userId: "another-user",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.createSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated users (AC6)", async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await POST(
      makeRequest({ placeId: "place-1", type: "WISHLIST" })
    );

    expect(response.status).toBe(401);
    expect(mocks.createSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects requests from another origin", async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await POST(
      makeRequest({ placeId: "place-1", type: "WISHLIST" })
    );

    expect(response.status).toBe(403);
    expect(mocks.createSavedPlace).not.toHaveBeenCalled();
  });

  it("returns 500 when the database fails", async () => {
    mocks.createSavedPlace.mockRejectedValue(new Error("Database failure"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await POST(
        makeRequest({ placeId: "place-1", type: "WISHLIST" })
      );

      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe("DELETE /api/saved-places", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.requireUser.mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
    });

    mocks.deleteSavedPlace.mockResolvedValue({ count: 1 });
    mocks.deleteListEntries.mockResolvedValue({ count: 1 });

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        savedPlace: {
          deleteMany: mocks.deleteSavedPlace,
        },
        listEntry: {
          deleteMany: mocks.deleteListEntries,
        },
      })
    );
  });

  it("removes a place from the wishlist (AC3)", async () => {
    const response = await DELETE(
      makeRequest({ placeId: "place-1", type: "WISHLIST" }, "DELETE")
    );

    expect(response.status).toBe(204);
    expect(mocks.deleteSavedPlace).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        placeId: "place-1",
        type: "WISHLIST",
      },
    });
  });

  it("removes a place from bookmarks (AC3)", async () => {
    const response = await DELETE(
      makeRequest({ placeId: "place-1", type: "BOOKMARK" }, "DELETE")
    );

    expect(response.status).toBe(204);
    expect(mocks.deleteSavedPlace).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        placeId: "place-1",
        type: "BOOKMARK",
      },
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();

    expect(mocks.deleteListEntries).toHaveBeenCalledExactlyOnceWith({
      where: {
        placeId: "place-1",
        list: {
          userId: "user-1",
        },
      },
    });
  });

  it("removes only the selected list type (AC4)", async () => {
    const response = await DELETE(
      makeRequest({ placeId: "place-1", type: "WISHLIST" }, "DELETE")
    );

    expect(response.status).toBe(204);

    expect(mocks.deleteSavedPlace).toHaveBeenCalledExactlyOnceWith({
      where: {
        userId: "user-1",
        placeId: "place-1",
        type: "WISHLIST",
      },
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteListEntries).not.toHaveBeenCalled();
  });

  it("does not remove another user's saved place", async () => {
    mocks.deleteSavedPlace.mockResolvedValue({ count: 0 });

    const response = await DELETE(
      makeRequest({ placeId: "place-1", type: "BOOKMARK" }, "DELETE")
    );

    expect(response.status).toBe(404);
    expect(mocks.deleteSavedPlace).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        placeId: "place-1",
        type: "BOOKMARK",
      },
    });

    expect(mocks.deleteListEntries).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    const response = await DELETE(
      makeRequest({ placeId: "", type: "INVALID" }, "DELETE")
    );

    expect(response.status).toBe(400);
    expect(mocks.deleteSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects a client-supplied userId", async () => {
    const response = await DELETE(
      makeRequest(
        {
          placeId: "place-1",
          type: "WISHLIST",
          userId: "another-user",
        },
        "DELETE"
      )
    );

    expect(response.status).toBe(400);
    expect(mocks.deleteSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated users (AC6)", async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await DELETE(
      makeRequest({ placeId: "place-1", type: "WISHLIST" }, "DELETE")
    );

    expect(response.status).toBe(401);
    expect(mocks.deleteSavedPlace).not.toHaveBeenCalled();
  });

  it("rejects requests from another origin", async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await DELETE(
      makeRequest({ placeId: "place-1", type: "WISHLIST" }, "DELETE")
    );

    expect(response.status).toBe(403);
    expect(mocks.deleteSavedPlace).not.toHaveBeenCalled();
  });

  it("returns 500 if removing a bookmark from custom lists fails", async () => {
    mocks.deleteListEntries.mockRejectedValue(new Error("Database failure"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await DELETE(
        makeRequest({ placeId: "place-1", type: "BOOKMARK" }, "DELETE")
      );

      expect(response.status).toBe(500);
      expect(mocks.transaction).toHaveBeenCalledOnce();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("returns 500 when the database fails", async () => {
    mocks.deleteSavedPlace.mockRejectedValue(new Error("Database failure"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await DELETE(
        makeRequest({ placeId: "place-1", type: "WISHLIST" }, "DELETE")
      );

      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe("GET /api/saved-places", () => {
  const savedPlace = {
    id: "saved-1",
    type: "WISHLIST",
    savedAt: new Date("2026-11-18T12:00:00Z"),
    place: {
      id: "place-1",
      name: "Test Place",
      category: "MUSEUM",
      address: "Porto, Portugal",
      latitude: 41.15,
      longitude: -8.61,
      priceLevel: "FREE",
      averageRating: 4.5,
      reviewCount: 2,
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mocks.requireUser.mockResolvedValue({
      ok: true,
      user: { id: "user-1" },
    });

    mocks.findSavedPlaces.mockResolvedValue([savedPlace]);
  });

  function getRequest(type?: string): Request {
    const url = new URL("http://localhost:3000/api/saved-places");

    if (type !== undefined) {
      url.searchParams.set("type", type);
    }

    return new Request(url, { method: "GET" });
  }

  it("returns the authenticated user's saved places", async () => {
    const response = await GET(getRequest());

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].place.name).toBe("Test Place");

    expect(mocks.findSavedPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { savedAt: "desc" },
      })
    );
  });

  it("filters saved places by WISHLIST", async () => {
    const response = await GET(getRequest("WISHLIST"));

    expect(response.status).toBe(200);

    expect(mocks.findSavedPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          type: "WISHLIST",
        },
      })
    );
  });

  it("filters saved places by BOOKMARK", async () => {
    const response = await GET(getRequest("BOOKMARK"));

    expect(response.status).toBe(200);

    expect(mocks.findSavedPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          type: "BOOKMARK",
        },
      })
    );
  });

  it("returns an empty list when no places are saved", async () => {
    mocks.findSavedPlaces.mockResolvedValue([]);

    const response = await GET(getRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("rejects an invalid list type", async () => {
    const response = await GET(getRequest("FAVORITE"));

    expect(response.status).toBe(400);
    expect(mocks.findSavedPlaces).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated users", async () => {
    mocks.requireUser.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Log in to do this" }, { status: 401 }),
    });

    const response = await GET(getRequest());

    expect(response.status).toBe(401);
    expect(mocks.findSavedPlaces).not.toHaveBeenCalled();
  });

  it("uses the session user ID, not another user's ID", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/api/saved-places?userId=another-user",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);

    expect(mocks.findSavedPlaces).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      })
    );
  });

  it("returns 500 when the database fails", async () => {
    mocks.findSavedPlaces.mockRejectedValue(new Error("Database failure"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await GET(getRequest());

      expect(response.status).toBe(500);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
