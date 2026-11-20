/**
 * Saved places of the logged-in person: the wishlist ("I want to go") and the
 * bookmarks ("remember this"). Pure functions, so the rules can be tested without the UI or the API.
 *
 * - A place is saved at most once per type, and the two types are independent: removing a place from
 *   one keeps it in the other.
 * - The UI changes at once and goes back if the server refuses (the reducer below).
 */

export const SAVED_PLACE_TYPES = ["WISHLIST", "BOOKMARK"] as const;

export type SavedPlaceType = (typeof SAVED_PLACE_TYPES)[number];

export interface SavedPlaceSummary {
  id: string;
  name: string;
  category: string;
  address?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  priceLevel?: string | null;
  city?: { name: string; country: string } | null;
}

export interface SavedPlace {
  type: SavedPlaceType;
  savedAt: string;
  place: SavedPlaceSummary;
}

/** The words of each type, on the buttons and on the "My places" page. */
export const SAVED_PLACE_LABELS: Record<
  SavedPlaceType,
  { section: string; add: string; remove: string; saved: string; empty: string }
> = {
  WISHLIST: {
    section: "Wishlist",
    add: "Add to wishlist",
    remove: "Remove from wishlist",
    saved: "On your wishlist",
    empty: "Your wishlist is empty. Use the heart on a place to add it.",
  },
  BOOKMARK: {
    section: "Bookmarks",
    add: "Bookmark",
    remove: "Remove bookmark",
    saved: "Bookmarked",
    empty: "You have no bookmarks. Use the bookmark on a place to add it.",
  },
};

export function isSavedPlaceType(value: unknown): value is SavedPlaceType {
  return SAVED_PLACE_TYPES.includes(value as SavedPlaceType);
}

export function savedKey(placeId: string, type: SavedPlaceType): string {
  return `${type}:${placeId}`;
}

export function isSavedAs(
  saved: readonly SavedPlace[],
  placeId: string,
  type: SavedPlaceType
): boolean {
  return saved.some(
    (entry) => entry.type === type && entry.place.id === placeId
  );
}

export function withSaved(
  saved: readonly SavedPlace[],
  entry: SavedPlace
): SavedPlace[] {
  return [entry, ...withoutSaved(saved, entry.place.id, entry.type)];
}

export function withoutSaved(
  saved: readonly SavedPlace[],
  placeId: string,
  type: SavedPlaceType
): SavedPlace[] {
  return saved.filter(
    (entry) => !(entry.type === type && entry.place.id === placeId)
  );
}

export function savedSections(
  saved: readonly SavedPlace[]
): Record<SavedPlaceType, SavedPlace[]> {
  const newestFirst = (a: SavedPlace, b: SavedPlace) =>
    b.savedAt.localeCompare(a.savedAt) ||
    a.place.name.localeCompare(b.place.name);

  return {
    WISHLIST: saved
      .filter((entry) => entry.type === "WISHLIST")
      .sort(newestFirst),
    BOOKMARK: saved
      .filter((entry) => entry.type === "BOOKMARK")
      .sort(newestFirst),
  };
}

// ── State of the saved places in the browser ─────────────────────────────────

export interface SavedPlacesState {
  /** `logged-out`: nothing is loaded and the buttons ask to log in. */
  status: "logged-out" | "loading" | "ready" | "error";
  saved: SavedPlace[];
  /** Keys (see `savedKey`) of the changes the server has not answered yet. */
  pending: string[];
  /** The last problem to show to the person, or null. */
  message: string | null;
}

export type SavedChange =
  { kind: "add"; entry: SavedPlace } | { kind: "remove"; entry: SavedPlace };

export type SavedPlacesAction =
  | { type: "load" }
  | { type: "loaded"; saved: SavedPlace[] }
  | { type: "load-failed"; message: string }
  | { type: "change-started"; change: SavedChange }
  | { type: "change-done"; change: SavedChange }
  | { type: "change-failed"; change: SavedChange; message: string }
  | { type: "dismiss" };

export function initialSavedPlacesState(loggedIn: boolean): SavedPlacesState {
  return {
    status: loggedIn ? "loading" : "logged-out",
    saved: [],
    pending: [],
    message: null,
  };
}

function changeKey(change: SavedChange): string {
  return savedKey(change.entry.place.id, change.entry.type);
}

export function savedPlacesReducer(
  state: SavedPlacesState,
  action: SavedPlacesAction
): SavedPlacesState {
  switch (action.type) {
    case "load":
      return state.status === "logged-out"
        ? state
        : { ...state, status: "loading", message: null };

    case "loaded":
      return { ...state, status: "ready", saved: action.saved, message: null };

    case "load-failed":
      return { ...state, status: "error", message: action.message };

    case "change-started": {
      const { change } = action;
      const key = changeKey(change);
      if (state.status !== "ready" || state.pending.includes(key)) {
        return state;
      }

      const saved =
        change.kind === "add"
          ? withSaved(state.saved, change.entry)
          : withoutSaved(state.saved, change.entry.place.id, change.entry.type);

      return {
        ...state,
        saved,
        pending: [...state.pending, key],
        message: null,
      };
    }

    case "change-done": {
      const key = changeKey(action.change);
      return {
        ...state,
        pending: state.pending.filter((item) => item !== key),
      };
    }

    case "change-failed": {
      const { change } = action;
      const key = changeKey(change);

      const saved =
        change.kind === "add"
          ? withoutSaved(state.saved, change.entry.place.id, change.entry.type)
          : withSaved(state.saved, change.entry);

      return {
        ...state,
        saved,
        pending: state.pending.filter((item) => item !== key),
        message: action.message,
      };
    }

    case "dismiss":
      return { ...state, message: null };
  }
}
