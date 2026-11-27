/** The id of the map card of the home page, which the Map buttons of the ranking bring into view. */
export const EXPLORE_MAP_ID = "explore-map";

/**
 * Brings the map of the home page into view after a Map button centred it on a place (#187). On a wide
 * screen the map is beside the ranking and already in view, so the page does not move and the person
 * keeps their place in the list; on a narrow one the map is above the ranking and the page scrolls to it.
 */
export function showMap(): void {
  const map = document.getElementById(EXPLORE_MAP_ID);
  if (!map) return;

  const { top, bottom } = map.getBoundingClientRect();
  if (top >= 0 && bottom <= window.innerHeight) return;

  map.scrollIntoView({ behavior: "smooth", block: "center" });
}
