"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import {
  initialSavedPlacesState,
  isSavedAs,
  savedKey,
  savedPlacesReducer,
  type SavedChange,
  type SavedPlace,
  type SavedPlacesState,
  type SavedPlaceSummary,
  type SavedPlaceType,
} from "@/domain/saved-places/saved-places";
import {
  fetchSavedPlaces,
  removeSavedPlace,
  savePlace,
} from "@/lib/saved-places";

interface SavedPlacesContextValue {
  status: SavedPlacesState["status"];
  saved: SavedPlace[];
  isSaved: (placeId: string, type: SavedPlaceType) => boolean;
  isPending: (placeId: string, type: SavedPlaceType) => boolean;
  /** Saves the place with that type, or removes it when it is already saved. */
  toggle: (place: SavedPlaceSummary, type: SavedPlaceType) => Promise<void>;
  reload: () => Promise<void>;
}

const SavedPlacesContext = createContext<SavedPlacesContextValue | null>(null);

/** The saved places of the page, or null outside a `SavedPlacesProvider`. */
export function useSavedPlaces(): SavedPlacesContextValue | null {
  return useContext(SavedPlacesContext);
}

export default function SavedPlacesProvider({
  loggedIn,
  children,
}: {
  loggedIn: boolean;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(
    savedPlacesReducer,
    loggedIn,
    initialSavedPlacesState
  );

  // The latest state for the callbacks, so two quick clicks do not read an old list.
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    if (!loggedIn) return;

    dispatch({ type: "load" });
    const result = await fetchSavedPlaces();
    dispatch(
      result.ok
        ? { type: "loaded", saved: result.saved }
        : { type: "load-failed", message: result.message }
    );
  }, [loggedIn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggle = useCallback(
    async (place: SavedPlaceSummary, type: SavedPlaceType) => {
      const current = stateRef.current;
      if (
        current.status !== "ready" ||
        current.pending.includes(savedKey(place.id, type))
      ) {
        return;
      }

      const existing = current.saved.find(
        (entry) => entry.type === type && entry.place.id === place.id
      );
      const change: SavedChange = existing
        ? { kind: "remove", entry: existing }
        : {
            kind: "add",
            entry: { type, savedAt: new Date().toISOString(), place },
          };

      dispatch({ type: "change-started", change });

      const result =
        change.kind === "add"
          ? await savePlace(place.id, type)
          : await removeSavedPlace(place.id, type);

      dispatch(
        result.ok
          ? { type: "change-done", change }
          : { type: "change-failed", change, message: result.message }
      );
    },
    []
  );

  const value = useMemo<SavedPlacesContextValue>(
    () => ({
      status: state.status,
      saved: state.saved,
      isSaved: (placeId, type) => isSavedAs(state.saved, placeId, type),
      isPending: (placeId, type) =>
        state.pending.includes(savedKey(placeId, type)),
      toggle,
      reload,
    }),
    [state.status, state.saved, state.pending, toggle, reload]
  );

  return (
    <SavedPlacesContext.Provider value={value}>
      {children}

      {state.message && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[1100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
        >
          <span>{state.message}</span>

          <div className="flex shrink-0 items-center gap-2">
            {state.status === "error" && (
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: "dismiss" })}
              aria-label="Dismiss"
              className="rounded p-0.5 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:hover:bg-rose-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </SavedPlacesContext.Provider>
  );
}
