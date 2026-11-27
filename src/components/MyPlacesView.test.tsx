/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import MyPlacesView from "./MyPlacesView";
import type { SavedPlace } from "@/domain/saved-places/saved-places";

const { savedPlaces, searchParams } = vi.hoisted(() => ({
  savedPlaces: { current: null as unknown },
  searchParams: { current: new URLSearchParams() },
}));

vi.mock("./SavedPlacesProvider", () => ({
  useSavedPlaces: () => savedPlaces.current,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.current,
}));

const PORTO = { id: "city-porto", name: "Porto", country: "Portugal" };
const PARIS = { id: "city-paris", name: "Paris", country: "France" };

function saved(
  id: string,
  type: SavedPlace["type"],
  city: typeof PORTO
): SavedPlace {
  return {
    type,
    savedAt: "2026-11-10T10:00:00.000Z",
    place: { id, name: `Place ${id}`, category: "MUSEUM", city },
  };
}

function show(entries: SavedPlace[], query = "") {
  searchParams.current = new URLSearchParams(query);
  savedPlaces.current = {
    status: "ready",
    saved: entries,
    isPending: () => false,
    toggle: vi.fn(),
    reload: vi.fn(),
  };
  return render(<MyPlacesView />);
}

const section = (name: RegExp) => screen.getByRole("region", { name });
const names = (region: HTMLElement) =>
  within(region)
    .queryAllByRole("link")
    .map((link) => link.textContent);

const ENTRIES = [
  saved("lello", "WISHLIST", PORTO),
  saved("lello", "BOOKMARK", PORTO),
  saved("serralves", "BOOKMARK", PORTO),
  saved("louvre", "WISHLIST", PARIS),
];

beforeEach(() => {
  searchParams.current = new URLSearchParams();
});
afterEach(() => cleanup());

describe("Saved: the filter by city (#187)", () => {
  it("shows each city with its number of places, a place in both lists counted once, and no All cities", () => {
    show(ENTRIES);

    const filter = screen.getByRole("navigation", { name: "Filter by city" });
    expect(
      within(filter)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Paris1", "/my-places?city=city-paris"],
      ["Porto2", "/my-places?city=city-porto"],
    ]);
  });

  it("opens on Porto when the address has no city", () => {
    show(ENTRIES);

    expect(
      screen.getByRole("link", { name: /^Porto/ }).getAttribute("aria-current")
    ).toBe("page");
    expect(names(section(/Wishlist/))).toEqual(["Place lello"]);
    expect(names(section(/Bookmarks/))).toEqual([
      "Place lello",
      "Place serralves",
    ]);
  });

  it("opens on the first city by name when nothing is saved in Porto", () => {
    const BERLIN = { id: "city-berlin", name: "Berlin", country: "Germany" };
    show([
      saved("louvre", "WISHLIST", PARIS),
      saved("tor", "WISHLIST", BERLIN),
    ]);

    expect(
      screen.getByRole("link", { name: /^Berlin/ }).getAttribute("aria-current")
    ).toBe("page");
    expect(names(section(/Wishlist/))).toEqual(["Place tor"]);
  });

  it("filters both lists and their counts by the city of the address", () => {
    show(ENTRIES, "city=city-paris");

    expect(
      screen.getByRole("link", { name: /^Paris/ }).getAttribute("aria-current")
    ).toBe("page");
    expect(names(section(/Wishlist/))).toEqual(["Place louvre"]);
    expect(section(/Wishlist/).textContent).toContain("(1)");
    expect(names(section(/Bookmarks/))).toEqual([]);
    expect(section(/Bookmarks/).textContent).toContain("(0)");
  });

  it("says a list is empty in that city, instead of the message for an empty list", () => {
    show(ENTRIES, "city=city-paris");

    expect(screen.getByText("No bookmarks in Paris.")).toBeTruthy();
    expect(screen.queryByText(/You have no bookmarks/)).toBeNull();
  });

  it("opens on Porto for a city of the address that has none of the saved places", () => {
    show(ENTRIES, "city=city-berlin");

    expect(
      screen.getByRole("link", { name: /^Porto/ }).getAttribute("aria-current")
    ).toBe("page");
    expect(screen.queryByRole("link", { name: /^All cities/ })).toBeNull();
  });

  it("shows no filter, and the places of that city, when every saved place is in one city", () => {
    show([saved("louvre", "WISHLIST", PARIS)]);

    expect(
      screen.queryByRole("navigation", { name: "Filter by city" })
    ).toBeNull();
    expect(names(section(/Wishlist/))).toEqual(["Place louvre"]);
  });

  it("shows the city of each place on its row", () => {
    show(ENTRIES, "city=city-paris");

    expect(within(section(/Wishlist/)).getByText(/Paris/)).toBeTruthy();
  });
});

describe("Saved: where each place is (#187)", () => {
  it("says the city once when the address already ends with it", () => {
    const louvre = saved("louvre", "WISHLIST", PARIS);
    louvre.place.address = "Rue de Rivoli, 75001, Paris";
    show([louvre]);

    expect(screen.getByText("Rue de Rivoli, 75001, Paris")).toBeTruthy();
    expect(screen.queryByText(/Paris, Paris/)).toBeNull();
  });
});
