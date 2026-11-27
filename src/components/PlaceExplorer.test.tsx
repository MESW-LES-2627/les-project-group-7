/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceCategory } from "@prisma/client";
import PlaceExplorer, { type PlaceItem } from "./PlaceExplorer";
import type { MapWrapperProps } from "./MapWrapper";
import { forgetExplore, recallExplore } from "@/lib/explore-memory";

// The real map needs a browser with a layout; this one keeps what the page gives it, so a test can move it
const { map } = vi.hoisted(() => ({
  map: { props: null as MapWrapperProps | null },
}));
vi.mock("./MapWrapper", () => ({
  default: (props: MapWrapperProps) => {
    map.props = props;
    return null;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const CITIES = [
  {
    id: "city-porto",
    name: "Porto",
    country: "Portugal",
    latitude: 41.1579,
    longitude: -8.6291,
    count: 1,
  },
  {
    id: "city-paris",
    name: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    count: 1,
  },
];

function place(
  id: string,
  name: string,
  cityId: string,
  lat: number,
  lng: number
): PlaceItem {
  return {
    id,
    name,
    category: PlaceCategory.MUSEUM,
    address: "",
    latitude: lat,
    longitude: lng,
    averageRating: 4.5,
    reviewCount: 3,
    cityId,
  } as PlaceItem;
}

const PLACES = [
  place("serralves", "Serralves", "city-porto", 41.159, -8.66),
  place("louvre", "Louvre", "city-paris", 48.861, 2.336),
];

/** The map as the person leaves it: an area about 10 km across around a point, or the whole of Europe. */
const AROUND_PARIS = { south: 48.81, north: 48.9, west: 2.28, east: 2.42 };
const AROUND_PORTO = { south: 41.11, north: 41.2, west: -8.69, east: -8.56 };
const EUROPE = { south: 36, north: 56, west: -10, east: 20 };

function moveMap(area: typeof EUROPE) {
  act(() => map.props!.onMapMove!(area));
}

const heading = () => screen.getByRole("heading", { level: 2 }).textContent;

function openHome(places = PLACES) {
  return render(
    <PlaceExplorer
      initialPlaces={places}
      initialCities={CITIES}
      currentUsername={null}
    />
  );
}

beforeEach(() => {
  forgetExplore();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, json: async () => [] })
  );
  openHome();
});

afterEach(() => {
  forgetExplore();
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PlaceExplorer: the ranking follows the city of the map (#187)", () => {
  it("shows the city the map opens on", () => {
    moveMap(AROUND_PORTO);

    expect(heading()).toBe("Place ranking in Porto");
    expect(screen.queryByText("Louvre")).toBeNull();
  });

  it("switches to the city the person moves the map to", () => {
    moveMap(AROUND_PORTO);
    moveMap(AROUND_PARIS);

    expect(heading()).toBe("Place ranking in Paris");
    expect(screen.getAllByText("Louvre").length).toBeGreaterThan(0);
    expect(screen.queryByText("Serralves")).toBeNull();
  });

  it("shows all cities when the map is zoomed out past a city", () => {
    moveMap(AROUND_PORTO);
    moveMap(EUROPE);

    expect(heading()).toBe("Place ranking");
    expect(screen.getAllByText("Louvre").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Serralves").length).toBeGreaterThan(0);
  });

  it("does not switch the city when a Map button of the ranking moves the map", async () => {
    moveMap(EUROPE);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: /^Map$/ })[0]);
    moveMap(AROUND_PARIS);

    expect(heading()).toBe("Place ranking");
  });

  it("follows the person's own moves again after a Map button", async () => {
    moveMap(EUROPE);
    const user = userEvent.setup();

    await user.click(screen.getAllByRole("button", { name: /^Map$/ })[0]);
    moveMap(AROUND_PARIS);
    vi.setSystemTime(Date.now() + 5000);
    moveMap(AROUND_PARIS);

    expect(heading()).toBe("Place ranking in Paris");
  });

  it("zooms the map out to every city for All cities", async () => {
    moveMap(AROUND_PORTO);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^All cities/ }));

    expect(heading()).toBe("Place ranking");
    expect(map.props!.fitPoints).toEqual([
      [41.1579, -8.6291],
      [48.8566, 2.3522],
    ]);
  });

  it("flies to a city chosen with its button, and the ranking shows it", async () => {
    moveMap(EUROPE);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /^Paris/ }));

    expect(heading()).toBe("Place ranking in Paris");
    expect(map.props!.selectedCityCenter).toEqual([48.8566, 2.3522]);
  });

  it("switches to the city of a place picked in the search box, so the ranking is not empty", async () => {
    moveMap(AROUND_PORTO);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/Search places/), "Louv");
    await user.click(screen.getByRole("button", { name: /Louvre/ }));
    moveMap(AROUND_PARIS);

    expect(heading()).toBe("Place ranking in Paris");
    expect(
      screen.queryByText("No places found with the current filters.")
    ).toBeNull();
  });
});

describe("PlaceExplorer: the home page comes back as it was left (#187)", () => {
  /** Leaves the home page (a place page, Back, the Tripbook link) and comes back to it. */
  function leaveAndComeBack(places = PLACES) {
    cleanup();
    map.props = null;
    openHome(places);
  }

  it("opens the map where it was, and the ranking on its city, before the map moves", () => {
    moveMap(AROUND_PARIS);
    act(() => map.props!.onViewChange!([48.855, 2.35], 13));

    leaveAndComeBack();

    expect(map.props!.center).toEqual([48.855, 2.35]);
    expect(map.props!.zoom).toBe(13);
    expect(heading()).toBe("Place ranking in Paris");
  });

  it("keeps the search, the filters and Table or Cards", async () => {
    moveMap(AROUND_PORTO);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Museums" }));
    await user.click(screen.getByRole("button", { name: /Cards/ }));
    await user.type(screen.getByPlaceholderText(/Search places/), "Serr");

    leaveAndComeBack();

    expect(
      (screen.getByPlaceholderText(/Search places/) as HTMLInputElement).value
    ).toBe("Serr");
    expect(screen.getByRole("button", { name: "Museums" }).className).toContain(
      "bg-indigo"
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps the page of the ranking, also after the map reports where it is", async () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      place(
        `p${i}`,
        `Place ${String(i).padStart(2, "0")}`,
        "city-porto",
        41.15,
        -8.62
      )
    );
    leaveAndComeBack(many);
    moveMap(AROUND_PORTO);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();

    leaveAndComeBack(many);
    moveMap(AROUND_PORTO);

    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("keeps the city it was left on, even when the map was moved there by a Map button", async () => {
    moveMap(EUROPE);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: /^Map$/ })[0]);

    leaveAndComeBack();
    moveMap(AROUND_PARIS);

    expect(heading()).toBe("Place ranking");
  });

  it("starts on Porto after a refresh, when nothing is remembered", () => {
    moveMap(AROUND_PARIS);
    act(() => map.props!.onViewChange!([48.855, 2.35], 13));

    forgetExplore();
    leaveAndComeBack();

    expect(map.props!.center).toEqual([41.147, -8.615]);
    expect(map.props!.zoom).toBe(14);
  });
});

describe("PlaceExplorer: how far down the page was (#187)", () => {
  /** Scrolls down and clicks, like a click on a link that leaves the page. */
  function scrollTo(y: number) {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    act(() => {
      document.body.click();
    });
  }

  function comeBack(byHistory: boolean) {
    cleanup();
    if (byHistory) window.dispatchEvent(new PopStateEvent("popstate"));
    openHome();
  }

  afterEach(() => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("remembers how far down the page is when a click leaves it", () => {
    scrollTo(1373);

    expect(recallExplore().scrollY).toBe(1373);
  });

  it("does not forget it when the next page scrolls to its top before this one is gone", () => {
    scrollTo(1373);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(recallExplore().scrollY).toBe(1373);
  });

  it("goes back down there with Back or Forward", async () => {
    const scrolled = vi.fn();
    vi.stubGlobal("scrollTo", scrolled);
    scrollTo(1373);

    comeBack(true);

    await waitFor(() => expect(scrolled).toHaveBeenCalledWith(0, 1373));
  });

  it("starts at the top when it is reached by a link, like the Tripbook link", async () => {
    const scrolled = vi.fn();
    vi.stubGlobal("scrollTo", scrolled);
    scrollTo(1373);

    comeBack(false);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(scrolled).not.toHaveBeenCalled();
  });
});
