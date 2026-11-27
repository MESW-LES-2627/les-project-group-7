import { describe, it, expect } from "vitest";
import {
  initialSavedPlacesState,
  isSavedAs,
  isSavedPlaceType,
  savedCityCounts,
  savedInCity,
  savedPlacesReducer,
  savedSections,
  withSaved,
  withoutSaved,
  type SavedPlace,
  type SavedPlacesState,
} from "./saved-places";

function entry(
  placeId: string,
  type: SavedPlace["type"],
  savedAt = "2026-11-10T10:00:00.000Z",
  name = `Place ${placeId}`
): SavedPlace {
  return { type, savedAt, place: { id: placeId, name, category: "MUSEUM" } };
}

const LELLO_WISH = entry("lello", "WISHLIST");
const LELLO_BOOK = entry("lello", "BOOKMARK");
const SERRALVES_WISH = entry("serralves", "WISHLIST");

function ready(saved: SavedPlace[]): SavedPlacesState {
  return { status: "ready", saved, pending: [], message: null };
}

describe("isSavedPlaceType", () => {
  it("accepts the two types only", () => {
    expect(isSavedPlaceType("WISHLIST")).toBe(true);
    expect(isSavedPlaceType("BOOKMARK")).toBe(true);
    expect(isSavedPlaceType("wishlist")).toBe(false);
    expect(isSavedPlaceType(undefined)).toBe(false);
  });
});

describe("isSavedAs", () => {
  it("is true only for the place and type that were saved", () => {
    const saved = [LELLO_WISH];

    expect(isSavedAs(saved, "lello", "WISHLIST")).toBe(true);
    expect(isSavedAs(saved, "lello", "BOOKMARK")).toBe(false);
    expect(isSavedAs(saved, "serralves", "WISHLIST")).toBe(false);
  });
});

describe("withSaved", () => {
  it("adds the place first", () => {
    expect(withSaved([SERRALVES_WISH], LELLO_WISH)).toEqual([
      LELLO_WISH,
      SERRALVES_WISH,
    ]);
  });

  it("keeps one entry per place and type when the place is saved again", () => {
    const again = entry("lello", "WISHLIST", "2026-11-12T09:00:00.000Z");

    expect(withSaved([LELLO_WISH, SERRALVES_WISH], again)).toEqual([
      again,
      SERRALVES_WISH,
    ]);
  });

  it("keeps the wishlist and the bookmark of the same place apart", () => {
    expect(withSaved([LELLO_WISH], LELLO_BOOK)).toEqual([
      LELLO_BOOK,
      LELLO_WISH,
    ]);
  });
});

describe("withoutSaved", () => {
  it("removes the place from that type", () => {
    expect(
      withoutSaved([LELLO_WISH, SERRALVES_WISH], "lello", "WISHLIST")
    ).toEqual([SERRALVES_WISH]);
  });

  it("keeps the place in the other type", () => {
    expect(withoutSaved([LELLO_WISH, LELLO_BOOK], "lello", "WISHLIST")).toEqual(
      [LELLO_BOOK]
    );
    expect(withoutSaved([LELLO_WISH, LELLO_BOOK], "lello", "BOOKMARK")).toEqual(
      [LELLO_WISH]
    );
  });

  it("changes nothing when the place was not saved", () => {
    expect(withoutSaved([LELLO_WISH], "serralves", "WISHLIST")).toEqual([
      LELLO_WISH,
    ]);
  });
});

describe("savedSections", () => {
  it("splits the wishlist and the bookmarks, the most recently saved first", () => {
    const older = entry("a", "WISHLIST", "2026-11-01T10:00:00.000Z");
    const newer = entry("b", "WISHLIST", "2026-11-05T10:00:00.000Z");

    expect(savedSections([older, LELLO_BOOK, newer])).toEqual({
      WISHLIST: [newer, older],
      BOOKMARK: [LELLO_BOOK],
    });
  });

  it("orders places saved at the same time by name", () => {
    const zoo = entry("z", "BOOKMARK", "2026-11-01T10:00:00.000Z", "Zoo");
    const arch = entry("a", "BOOKMARK", "2026-11-01T10:00:00.000Z", "Arch");

    expect(savedSections([zoo, arch]).BOOKMARK).toEqual([arch, zoo]);
  });

  it("gives two empty sections when nothing is saved", () => {
    expect(savedSections([])).toEqual({ WISHLIST: [], BOOKMARK: [] });
  });
});

describe("savedPlacesReducer: loading", () => {
  it("starts loading when logged in, and logged out otherwise", () => {
    expect(initialSavedPlacesState(true).status).toBe("loading");
    expect(initialSavedPlacesState(false).status).toBe("logged-out");
  });

  it("is ready with the loaded places", () => {
    const state = savedPlacesReducer(initialSavedPlacesState(true), {
      type: "loaded",
      saved: [LELLO_WISH],
    });

    expect(state).toEqual(ready([LELLO_WISH]));
  });

  it("keeps the message when loading fails, and clears it when loading again", () => {
    const failed = savedPlacesReducer(initialSavedPlacesState(true), {
      type: "load-failed",
      message: "Could not load",
    });
    expect(failed).toMatchObject({
      status: "error",
      message: "Could not load",
    });

    expect(savedPlacesReducer(failed, { type: "load" })).toMatchObject({
      status: "loading",
      message: null,
    });
  });

  it("does not load when logged out", () => {
    const loggedOut = initialSavedPlacesState(false);

    expect(savedPlacesReducer(loggedOut, { type: "load" })).toBe(loggedOut);
  });
});

describe("savedPlacesReducer: a change shows at once", () => {
  it("adds the place and marks it pending until the server answers", () => {
    const change = { kind: "add" as const, entry: LELLO_WISH };

    const started = savedPlacesReducer(ready([]), {
      type: "change-started",
      change,
    });
    expect(started.saved).toEqual([LELLO_WISH]);
    expect(started.pending).toEqual(["WISHLIST:lello"]);

    const done = savedPlacesReducer(started, { type: "change-done", change });
    expect(done).toEqual(ready([LELLO_WISH]));
  });

  it("removes the place from one type and keeps the other", () => {
    const state = savedPlacesReducer(ready([LELLO_WISH, LELLO_BOOK]), {
      type: "change-started",
      change: { kind: "remove", entry: LELLO_WISH },
    });

    expect(state.saved).toEqual([LELLO_BOOK]);
  });

  it("ignores a second click on the same place and type while the first is pending", () => {
    const change = { kind: "add" as const, entry: LELLO_WISH };
    const started = savedPlacesReducer(ready([]), {
      type: "change-started",
      change,
    });

    expect(
      savedPlacesReducer(started, { type: "change-started", change })
    ).toBe(started);
  });

  it("ignores changes before the saved places are loaded", () => {
    const loading = initialSavedPlacesState(true);

    expect(
      savedPlacesReducer(loading, {
        type: "change-started",
        change: { kind: "add", entry: LELLO_WISH },
      })
    ).toBe(loading);
  });
});

describe("savedPlacesReducer: a refused change goes back", () => {
  it("takes out a place the server did not save, and shows why", () => {
    const change = { kind: "add" as const, entry: LELLO_WISH };
    const started = savedPlacesReducer(ready([SERRALVES_WISH]), {
      type: "change-started",
      change,
    });

    expect(
      savedPlacesReducer(started, {
        type: "change-failed",
        change,
        message: "Could not save the place. Please try again.",
      })
    ).toEqual({
      status: "ready",
      saved: [SERRALVES_WISH],
      pending: [],
      message: "Could not save the place. Please try again.",
    });
  });

  it("puts back a place the server did not remove", () => {
    const change = { kind: "remove" as const, entry: LELLO_WISH };
    const started = savedPlacesReducer(ready([LELLO_WISH, LELLO_BOOK]), {
      type: "change-started",
      change,
    });

    const failed = savedPlacesReducer(started, {
      type: "change-failed",
      change,
      message: "Could not remove the place. Please try again.",
    });

    expect(failed.saved).toEqual(
      expect.arrayContaining([LELLO_WISH, LELLO_BOOK])
    );
    expect(failed.saved).toHaveLength(2);
    expect(failed.pending).toEqual([]);
  });

  it("only undoes the refused change, not another one made meanwhile", () => {
    const lello = { kind: "add" as const, entry: LELLO_WISH };
    const serralves = { kind: "add" as const, entry: SERRALVES_WISH };

    let state = savedPlacesReducer(ready([]), {
      type: "change-started",
      change: lello,
    });
    state = savedPlacesReducer(state, {
      type: "change-started",
      change: serralves,
    });
    state = savedPlacesReducer(state, {
      type: "change-failed",
      change: lello,
      message: "Could not save the place. Please try again.",
    });

    expect(state.saved).toEqual([SERRALVES_WISH]);
    expect(state.pending).toEqual(["WISHLIST:serralves"]);
  });

  it("hides the message when dismissed", () => {
    const withMessage = { ...ready([]), message: "Could not save" };

    expect(savedPlacesReducer(withMessage, { type: "dismiss" }).message).toBe(
      null
    );
  });
});

describe("savedCityCounts and savedInCity: the filter by city of the Saved page (#187)", () => {
  const inCity = (
    placeId: string,
    type: SavedPlace["type"],
    city: { id: string; name: string } | null
  ): SavedPlace => ({
    ...entry(placeId, type),
    place: {
      ...entry(placeId, type).place,
      city: city && { ...city, country: "X" },
    },
  });
  const PORTO = { id: "city-porto", name: "Porto" };
  const PARIS = { id: "city-paris", name: "Paris" };
  const SAVED = [
    inCity("lello", "WISHLIST", PORTO),
    inCity("lello", "BOOKMARK", PORTO),
    inCity("serralves", "BOOKMARK", PORTO),
    inCity("louvre", "WISHLIST", PARIS),
    inCity("unknown", "WISHLIST", null),
  ];

  it("counts each place once per city, even when it is in both lists", () => {
    expect(savedCityCounts(SAVED)).toEqual([
      { id: "city-paris", name: "Paris", count: 1 },
      { id: "city-porto", name: "Porto", count: 2 },
    ]);
  });

  it("leaves out a place whose city is not known from the counts", () => {
    expect(savedCityCounts([inCity("unknown", "WISHLIST", null)])).toEqual([]);
  });

  it("keeps every place for all cities, and only the places of a city when one is chosen", () => {
    expect(savedInCity(SAVED, null)).toHaveLength(5);
    expect(savedInCity(SAVED, "city-porto").map((e) => e.place.id)).toEqual([
      "lello",
      "lello",
      "serralves",
    ]);
  });
});
