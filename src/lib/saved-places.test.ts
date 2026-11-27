import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchSavedPlaces,
  parseSavedPlaces,
  removeSavedPlace,
  savePlace,
} from "./saved-places";

function stubFetch(status: number, body?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      })
    )
  );
}

function stubOffline() {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const LELLO = {
  type: "WISHLIST",
  savedAt: "2026-11-10T10:00:00.000Z",
  place: {
    id: "lello",
    name: "Livraria Lello",
    category: "MUSEUM",
    address: "Rua das Carmelitas 144",
    averageRating: 4.4,
    reviewCount: 12,
    priceLevel: "€",
    city: { id: "city-porto", name: "Porto", country: "Portugal" },
  },
};

describe("parseSavedPlaces", () => {
  it("reads the saved places", () => {
    expect(parseSavedPlaces([LELLO])).toEqual([LELLO]);
  });

  it("reads an entry as GET /api/saved-places sends it", () => {
    const fromApi = {
      id: "saved-1",
      type: "BOOKMARK",
      savedAt: "2026-11-10T10:00:00.000Z",
      place: {
        id: "lello",
        name: "Livraria Lello",
        category: "MUSEUM",
        address: "Rua das Carmelitas 144",
        latitude: 41.1466,
        longitude: -8.6149,
        priceLevel: "€",
        averageRating: 4.4,
        reviewCount: 12,
      },
    };

    expect(parseSavedPlaces([fromApi])).toEqual([
      {
        type: "BOOKMARK",
        savedAt: "2026-11-10T10:00:00.000Z",
        place: {
          id: "lello",
          name: "Livraria Lello",
          category: "MUSEUM",
          address: "Rua das Carmelitas 144",
          averageRating: 4.4,
          reviewCount: 12,
          priceLevel: "€",
          city: null,
        },
      },
    ]);
  });

  it("fills the optional fields of a place that has only an id and a name", () => {
    expect(
      parseSavedPlaces([
        {
          type: "BOOKMARK",
          savedAt: "2026-11-10",
          place: { id: "p", name: "P" },
        },
      ])
    ).toEqual([
      {
        type: "BOOKMARK",
        savedAt: "2026-11-10",
        place: {
          id: "p",
          name: "P",
          category: "OTHER",
          address: null,
          averageRating: null,
          reviewCount: 0,
          priceLevel: null,
          city: null,
        },
      },
    ]);
  });

  it("leaves out entries without a known type, a date or a place with an id and a name", () => {
    expect(
      parseSavedPlaces([
        { ...LELLO, type: "FAVOURITE" },
        { ...LELLO, savedAt: undefined },
        { ...LELLO, place: { name: "No id" } },
        { ...LELLO, place: null },
        "text",
        LELLO,
      ])
    ).toEqual([LELLO]);
  });

  it("keeps the id of the city, which the filter by city uses (#187), and reads a city without one", () => {
    const [withoutId] = parseSavedPlaces([
      {
        ...LELLO,
        place: { ...LELLO.place, city: { name: "Porto", country: "Portugal" } },
      },
    ])!;

    expect(parseSavedPlaces([LELLO])![0].place.city?.id).toBe("city-porto");
    expect(withoutId.place.city).toEqual({
      name: "Porto",
      country: "Portugal",
    });
  });

  it("leaves out a city without both a name and a country", () => {
    const [noCountry, noName] = parseSavedPlaces([
      { ...LELLO, place: { ...LELLO.place, city: { name: "Porto" } } },
      { ...LELLO, place: { ...LELLO.place, city: { country: "Portugal" } } },
    ])!;

    expect(noCountry.place.city).toBeNull();
    expect(noName.place.city).toBeNull();
  });

  it("is null when the body is not a list", () => {
    expect(parseSavedPlaces({ savedPlaces: [LELLO] })).toBeNull();
    expect(parseSavedPlaces(null)).toBeNull();
  });
});

describe("fetchSavedPlaces", () => {
  it("loads the saved places on 200, without the browser cache", async () => {
    stubFetch(200, [LELLO]);

    expect(await fetchSavedPlaces()).toEqual({ ok: true, saved: [LELLO] });
    expect(fetch).toHaveBeenCalledWith("/api/saved-places", {
      cache: "no-store",
    });
  });

  it("asks to log in again on 401", async () => {
    stubFetch(401, { error: "Log in to do this" });

    expect(await fetchSavedPlaces()).toEqual({
      ok: false,
      message: "Your session expired. Log in again.",
    });
  });

  it.each([
    ["a server error", () => stubFetch(500)],
    ["a body that is not a list", () => stubFetch(200, { error: "x" })],
    ["a body that is not JSON", () => stubFetch(200)],
    ["a network failure", stubOffline],
  ])("gives a generic message on %s", async (_, stub) => {
    stub();

    expect(await fetchSavedPlaces()).toEqual({
      ok: false,
      message: "Could not load your saved places. Please try again.",
    });
  });
});

describe("savePlace", () => {
  it("sends the place and the type", async () => {
    stubFetch(201);

    expect(await savePlace("lello", "WISHLIST")).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/api/saved-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: "lello", type: "WISHLIST" }),
    });
  });

  it.each([200, 409])(
    "counts %s as done: the place was already saved",
    async (status) => {
      stubFetch(status);

      expect(await savePlace("lello", "BOOKMARK")).toEqual({ ok: true });
    }
  );

  it("asks to log in again on 401", async () => {
    stubFetch(401);

    expect(await savePlace("lello", "WISHLIST")).toEqual({
      ok: false,
      message: "Your session expired. Log in again.",
    });
  });

  it("says the place is gone on 404", async () => {
    stubFetch(404);

    expect(await savePlace("lello", "WISHLIST")).toEqual({
      ok: false,
      message: "This place does not exist any more.",
    });
  });

  it.each([
    ["a server error", () => stubFetch(500)],
    ["a refused request", () => stubFetch(400)],
    ["a network failure", stubOffline],
  ])("gives a generic message on %s", async (_, stub) => {
    stub();

    expect(await savePlace("lello", "WISHLIST")).toEqual({
      ok: false,
      message: "Could not save the place. Please try again.",
    });
  });
});

describe("removeSavedPlace", () => {
  it("sends the place and the type as JSON", async () => {
    stubFetch(204);

    expect(await removeSavedPlace("lello", "BOOKMARK")).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/api/saved-places", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: "lello", type: "BOOKMARK" }),
    });
  });

  it.each([200, 404])(
    "counts %s as done: the place is not saved any more",
    async (status) => {
      stubFetch(status);

      expect(await removeSavedPlace("lello", "WISHLIST")).toEqual({ ok: true });
    }
  );

  it("asks to log in again on 401", async () => {
    stubFetch(401);

    expect(await removeSavedPlace("lello", "WISHLIST")).toEqual({
      ok: false,
      message: "Your session expired. Log in again.",
    });
  });

  it.each([
    ["a server error", () => stubFetch(500)],
    ["a network failure", stubOffline],
  ])("gives a generic message on %s", async (_, stub) => {
    stub();

    expect(await removeSavedPlace("lello", "WISHLIST")).toEqual({
      ok: false,
      message: "Could not remove the place. Please try again.",
    });
  });
});
