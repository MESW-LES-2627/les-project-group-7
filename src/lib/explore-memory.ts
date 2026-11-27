import type { PlaceFilters } from "@/domain/catalog/filters";

/**
 * The home page as the person left it (#187): where the map was and how the ranking was set. It lives
 * in the memory of the page while the app is open, so Back, the Tripbook link or any link home bring it
 * back as it was; a refresh, a new tab or opening the site again start fresh, on Porto.
 */
export interface ExploreMemory {
  center: [number, number];
  zoom: number;
  /** The city of the ranking, null for all cities. */
  cityId: string | null;
  searchQuery: string;
  filters: PlaceFilters;
  currentPage: number;
  viewMode: "table" | "grid";
  /** How far down the page was, given back on Back or Forward only. */
  scrollY: number;
}

let memory: Partial<ExploreMemory> = {};

export function rememberExplore(change: Partial<ExploreMemory>): void {
  memory = { ...memory, ...change };
}

/** What was remembered, empty when nothing was. */
export function recallExplore(): Partial<ExploreMemory> {
  return structuredClone(memory);
}

/** Starts fresh; the tests use it, the app gets it from a refresh. */
export function forgetExplore(): void {
  memory = {};
  lastHistoryMove = 0;
}

// Back and Forward fire "popstate" just before the page is drawn again; a link does not. The time is kept
// so that an old Back, followed later by a link, does not count.
let lastHistoryMove = 0;
const HISTORY_MOVE_LASTS_MS = 1000;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastHistoryMove = Date.now();
  });
}

/**
 * Whether the page was just reached with Back or Forward. It is not used up when read: React starts a
 * page twice in development, and both starts have to see it; the short time is what makes it pass.
 */
export function cameBackByHistory(): boolean {
  return (
    lastHistoryMove > 0 && Date.now() - lastHistoryMove < HISTORY_MOVE_LASTS_MS
  );
}
