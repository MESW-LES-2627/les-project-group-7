/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPLORE_MAP_ID, showMap } from "./show-map";

function mapAt(top: number, bottom: number) {
  const map = document.createElement("div");
  map.id = EXPLORE_MAP_ID;
  map.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
  map.scrollIntoView = vi.fn();
  document.body.append(map);
  return map;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("showMap: the Map button of the ranking (#187)", () => {
  it("does not move the page when the map is already in view, beside the ranking on a wide screen", () => {
    vi.stubGlobal("innerHeight", 900);
    const map = mapAt(80, 760);

    showMap();

    expect(map.scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls to the map when it is above the screen, on a narrow screen where it is over the ranking", () => {
    vi.stubGlobal("innerHeight", 900);
    const map = mapAt(-1200, -500);

    showMap();

    expect(map.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("scrolls when only a part of the map is in view", () => {
    vi.stubGlobal("innerHeight", 900);
    const map = mapAt(600, 1300);

    showMap();

    expect(map.scrollIntoView).toHaveBeenCalled();
  });

  it("does nothing when there is no map on the page", () => {
    expect(() => showMap()).not.toThrow();
  });
});
