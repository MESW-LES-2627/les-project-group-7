/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceCategory } from "@prisma/client";
import ItineraryEditor from "./ItineraryEditor";
import type {
  EditorDay,
  EditorStop,
} from "@/domain/itinerary/itinerary-editor";
import type { PlaceItem } from "@/types/place";

vi.mock("@/components/MapWrapper", () => ({
  default: ({
    places,
    addAction,
  }: {
    places: { id: string }[];
    addAction?: { label: string; onAdd: (id: string) => void };
  }) => (
    <div data-testid="map">
      {places.length} pins
      {places.map((place) => (
        <button key={place.id} onClick={() => addAction?.onAdd(place.id)}>
          {addAction?.label} ({place.id})
        </button>
      ))}
    </div>
  ),
}));

const savedPlaces = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/components/SavedPlacesProvider", () => ({
  useSavedPlaces: () => savedPlaces.value,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const days: EditorDay[] = [
  { id: "d1", dayNumber: 1, date: "2026-12-01" },
  { id: "d2", dayNumber: 2, date: "2026-12-02" },
  { id: "d3", dayNumber: 3, date: "2026-12-03" },
];

function stop(
  id: string,
  dayId: string,
  position: number,
  visitTime: string | null = null
): EditorStop {
  return {
    id,
    dayId,
    placeId: `p-${id}`,
    position,
    visitTime,
    place: {
      id: `p-${id}`,
      name: `Place ${id}`,
      category: "MUSEUM",
      address: "Rua 1",
      latitude: 41.1,
      longitude: -8.6,
      priceLevel: null,
    },
  };
}

// Day 1: A (no time), B at 09:00, C at 11:00. Day 2: D.
const stops = [
  stop("A", "d1", 1),
  stop("B", "d1", 2, "09:00"),
  stop("C", "d1", 3, "11:00"),
  stop("D", "d2", 1),
];

const cityPlaces: PlaceItem[] = [
  {
    id: "louvre",
    name: "Louvre",
    category: PlaceCategory.MUSEUM,
    address: "Rue de Rivoli",
    latitude: 48.86,
    longitude: 2.33,
    averageRating: 4.5,
    reviewCount: 3,
  },
];

const base = {
  tripId: "t1",
  cityName: "Paris",
  days,
  initialStops: stops,
  cityPlaces,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => json({ stops }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  savedPlaces.value = null;
  cleanup();
  vi.unstubAllGlobals();
});

const move = (label: string, name: string) =>
  screen.getByRole("button", { name: `${label}: ${name}` });

const tab = (name: string | RegExp) => screen.getByRole("tab", { name });
const chooseDay = (n: number) => userEvent.click(tab(new RegExp(`^Day ${n}`)));
const openSearch = () => userEvent.click(tab("Search"));

describe("ItineraryEditor: the strip of days", () => {
  it("has one tab for each day, with the number of places, and Day 1 is chosen", () => {
    render(<ItineraryEditor {...base} />);

    expect(screen.getAllByRole("tab", { name: /^Day \d/ })).toHaveLength(3);
    expect(tab("Day 1, 3 places").getAttribute("aria-selected")).toBe("true");
    expect(tab("Day 2, 1 place").getAttribute("aria-selected")).toBe("false");
    expect(tab("Day 3, 0 places")).toBeTruthy();
  });

  it("shows the stops of the chosen day only", async () => {
    render(<ItineraryEditor {...base} />);

    expect(screen.getByText("Place A")).toBeTruthy();
    expect(screen.queryByText("Place D")).toBeNull();

    await chooseDay(2);

    expect(screen.getByText("Place D")).toBeTruthy();
    expect(screen.queryByText("Place A")).toBeNull();
  });

  it("moves between the days with the arrow keys, and the tab of the chosen day is the one in the tab order", async () => {
    render(<ItineraryEditor {...base} />);

    tab(/^Day 1/).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(tab(/^Day 2/).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab(/^Day 2/));
    expect(tab(/^Day 1/).getAttribute("tabindex")).toBe("-1");

    await userEvent.keyboard("{End}");
    expect(tab(/^Day 3/).getAttribute("aria-selected")).toBe("true");
  });

  it("says what to do in a day with nothing planned, with the date of the day", async () => {
    render(<ItineraryEditor {...base} />);

    await chooseDay(3);

    expect(
      screen.getByText("Nothing planned for Thu 3 Dec 2026 yet.")
    ).toBeTruthy();
  });

  it("opens the search for the chosen day, with the focus in its box, from Add a place", async () => {
    render(<ItineraryEditor {...base} />);
    await chooseDay(2);

    await userEvent.click(
      screen.getByRole("button", { name: "Add a place to Day 2" })
    );

    expect(tab("Search").getAttribute("aria-selected")).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Place"))
    );
    expect(screen.getByText(/Adding to/).textContent).toMatch(/Day 2/);
  });
});

describe("ItineraryEditor: the move buttons keep the focus and say why they do not work", () => {
  it("are aria-disabled, never disabled, when the move is not possible", () => {
    render(<ItineraryEditor {...base} />);

    const up = move("Move up", "Place A"); // A is the first stop of its day

    expect(up.getAttribute("aria-disabled")).toBe("true");
    expect((up as HTMLButtonElement).disabled).toBe(false);
  });

  it("can be focused when the move is not possible, and a click does nothing", async () => {
    render(<ItineraryEditor {...base} />);
    const up = move("Move up", "Place A");

    up.focus();
    await userEvent.click(up);

    expect(document.activeElement).toBe(up);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("describe the reason of a refused move by the order of the times", () => {
    render(<ItineraryEditor {...base} />);

    // C (11:00) cannot go above B (09:00): the stops with a time keep the order of their times
    const up = move("Move up", "Place C");
    const reasonId = up.getAttribute("aria-describedby");

    expect(up.getAttribute("aria-disabled")).toBe("true");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId as string)?.textContent).toMatch(
      /keep the order of their times/
    );
  });

  it("have no reason when the move is possible or only at the end of the day", () => {
    render(<ItineraryEditor {...base} />);

    expect(move("Move up", "Place B").getAttribute("aria-disabled")).toBe(
      "false"
    );
    expect(
      move("Move up", "Place A").getAttribute("aria-describedby")
    ).toBeNull();
  });

  it("keep the focus on the button that was pressed while the change is saved and after it", async () => {
    fetchMock.mockImplementation(async () =>
      json({
        stops: [
          stop("B", "d1", 1, "09:00"),
          stop("A", "d1", 2),
          stop("C", "d1", 3, "11:00"),
          stop("D", "d2", 1),
        ],
      })
    );
    render(<ItineraryEditor {...base} />);
    const up = move("Move up", "Place B");

    up.focus();
    await userEvent.click(up);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/trips/t1/stops/B");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      position: 1,
    });

    await waitFor(() =>
      expect(screen.getByText(/All changes saved|was/i)).toBeTruthy()
    );
    expect(document.activeElement).toBe(up);
  });
});

describe("ItineraryEditor: the day to add to", () => {
  async function addLouvre() {
    if (!screen.queryByLabelText("Place")) await openSearch();
    await userEvent.type(screen.getByLabelText("Place"), "Lou");
    await userEvent.click(await screen.findByText("Louvre"));
  }

  it("is the day that was chosen", async () => {
    fetchMock.mockImplementation(async () => json({ stops }));
    render(<ItineraryEditor {...base} />);

    await chooseDay(3);
    await addLouvre();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
        .dayId
    ).toBe("d3");
  });

  it("falls back to the first day when the chosen day is gone (the trip was made shorter)", async () => {
    const view = render(<ItineraryEditor {...base} />);
    await chooseDay(3);

    // The Edit trip dialog shortens the trip and the page reads its data again
    view.rerender(
      <ItineraryEditor
        {...base}
        days={days.slice(0, 2)}
        initialStops={stops.filter((item) => item.dayId !== "d3")}
      />
    );

    expect(tab(/^Day 1/).getAttribute("aria-selected")).toBe("true");

    await addLouvre();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // never the removed day: the API would answer "This day is not part of the trip"
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
        .dayId
    ).toBe("d1");
  });

  it("goes back to the chosen day if it is still there after the page is read again", async () => {
    const view = render(<ItineraryEditor {...base} />);
    await chooseDay(2);

    view.rerender(<ItineraryEditor {...base} initialStops={[...stops]} />);

    expect(tab(/^Day 2/).getAttribute("aria-selected")).toBe("true");
  });

  it("puts the focus back in the search box after a place was added", async () => {
    render(<ItineraryEditor {...base} />);

    await addLouvre();

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Place"))
    );
  });
});

describe("ItineraryEditor: the page is read again", () => {
  it("shows the stops it is given again, and drops the ones that are gone", async () => {
    const view = render(<ItineraryEditor {...base} />);
    await chooseDay(2);
    expect(screen.getByText("Place D")).toBeTruthy();

    view.rerender(
      <ItineraryEditor
        {...base}
        initialStops={stops.filter((item) => item.id !== "D")}
      />
    );

    expect(screen.queryByText("Place D")).toBeNull();
    await chooseDay(1);
    expect(screen.getByText("Place A")).toBeTruthy();
  });

  it("forgets the unsaved time of a stop that is gone", async () => {
    const view = render(<ItineraryEditor {...base} />);
    await chooseDay(2);
    const field = screen.getByLabelText("Visit time of Place D");

    await userEvent.type(field, "1030");
    expect(screen.getByText(/1 visit time is not saved yet/)).toBeTruthy();

    view.rerender(
      <ItineraryEditor
        {...base}
        initialStops={stops.filter((item) => item.id !== "D")}
      />
    );

    expect(screen.queryByText(/not saved yet/)).toBeNull();
  });
});

describe("ItineraryEditor: removing a stop and saving a time", () => {
  it("moves the focus to the Add button of its day when a stop is removed", async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 204 })
    );
    render(<ItineraryEditor {...base} />);
    await chooseDay(2);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Place D" })
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Add a place to Day 2" })
      )
    );
    expect(screen.queryByText("Place D")).toBeNull();
  });

  it("keeps the time field focused, read-only and not disabled, while the time is saved", async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve))
    );
    render(<ItineraryEditor {...base} />);
    await chooseDay(2);
    const field = screen.getByLabelText(
      "Visit time of Place D"
    ) as HTMLInputElement;

    await userEvent.type(field, "1030{Enter}");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(field.readOnly).toBe(true);
    expect(field.disabled).toBe(false);
    expect(document.activeElement).toBe(field);

    finish(json({ stops }));
    await waitFor(() => expect(field.readOnly).toBe(false));
  });
});

describe("the map", () => {
  it("adds a place of the city to the chosen day", async () => {
    render(<ItineraryEditor {...base} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 1 (louvre)" })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toMatchObject({ dayId: "d1", placeId: "louvre" });
  });

  it("says a place that is already on the trip is planned, without calling the API", async () => {
    render(<ItineraryEditor {...base} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 1 (p-A)" })
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a stop of a catalog place", () => {
  const withLouvre = [{ ...stop("L", "d1", 9), placeId: "louvre" }];

  it("shows its rating and reviews, and a link to its page", () => {
    render(<ItineraryEditor {...base} initialStops={withLouvre} />);

    expect(screen.getByText(/3 reviews/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Details and reviews of/ });
    expect(link.getAttribute("href")).toBe("/places/louvre");
  });

  it("has no link for a place that is not in the catalog", () => {
    render(<ItineraryEditor {...base} />);

    expect(screen.queryByRole("link", { name: /Details/ })).toBeNull();
  });
});

describe("the saved places panel", () => {
  it("adds a saved place of the city to the chosen day", async () => {
    savedPlaces.value = {
      status: "ready",
      reload: vi.fn(),
      saved: [
        {
          type: "WISHLIST",
          savedAt: "2026-11-01T10:00:00Z",
          place: { id: "louvre", name: "Louvre", category: "MUSEUM" },
        },
      ],
    };
    render(<ItineraryEditor {...base} />);
    await userEvent.click(tab("Saved"));

    await userEvent.click(
      screen.getByRole("button", { name: "Add Louvre to Day 1" })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toMatchObject({ dayId: "d1", placeId: "louvre" });
  });

  it("is not on the page outside the saved places provider", () => {
    render(<ItineraryEditor {...base} />);

    expect(screen.queryByRole("tab", { name: "Saved" })).toBeNull();
    expect(screen.queryByText(/Your saved places in/)).toBeNull();
  });
});

describe("the nearby places of a stop (US-E5-01, #64)", () => {
  // The stops are at 41.1, -8.6. 0.003 degrees north is about 334 m.
  const nearby: PlaceItem[] = [
    {
      id: "cafe",
      name: "Cafe Near",
      category: PlaceCategory.CAFE,
      address: "Rua 2",
      latitude: 41.103,
      longitude: -8.6,
      averageRating: 4.6,
      reviewCount: 12,
    },
    {
      // The place of the stop B: it is on the trip, so it is not suggested.
      id: "p-B",
      name: "Place B",
      category: PlaceCategory.MUSEUM,
      address: "Rua 1",
      latitude: 41.102,
      longitude: -8.6,
      averageRating: 5,
      reviewCount: 30,
    },
  ];
  const props = { ...base, cityPlaces: [...cityPlaces, ...nearby] };

  const openNearby = (name: string) =>
    userEvent.click(
      screen.getByRole("button", { name: `Nearby places for ${name}` })
    );

  it("has a Nearby button on each stop, and no Nearby tab before it is used", () => {
    render(<ItineraryEditor {...props} />);

    expect(
      screen.getAllByRole("button", { name: /^Nearby places for / })
    ).toHaveLength(3);
    expect(screen.queryByRole("tab", { name: "Nearby" })).toBeNull();
  });

  it("opens the Nearby tab for that stop, with the focus on its first control", async () => {
    render(<ItineraryEditor {...props} />);

    await openNearby("Place A");

    expect(tab("Nearby").getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("heading", { level: 2, name: "Near Place A" })
    ).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Type"))
    );
  });

  it("suggests places of the city near the stop, and not the ones already on the trip", async () => {
    render(<ItineraryEditor {...props} />);

    await openNearby("Place A");

    const list = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(list).toContain("Cafe Near");
    expect(list).not.toContain("Place B");
    expect(screen.queryByText("Louvre")).toBeNull();
  });

  it("adds a suggestion to the day of that stop, without a visit time", async () => {
    render(<ItineraryEditor {...props} />);
    await chooseDay(2);
    await openNearby("Place D");

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 2 (Cafe Near)" })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).toEqual({ dayId: "d2", placeId: "cafe" });
  });

  it("does not use the visit time typed in the Search tab", async () => {
    render(<ItineraryEditor {...props} />);
    await openSearch();
    await userEvent.type(
      screen.getByLabelText("Visit time (optional)"),
      "10:00"
    );
    await openNearby("Place A");

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 1 (Cafe Near)" })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).not.toHaveProperty("visitTime");
  });

  it("still adds to the day of the stop after another day is chosen", async () => {
    render(<ItineraryEditor {...props} />);
    await chooseDay(2);
    await openNearby("Place D");
    await chooseDay(1);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 2 (Cafe Near)" })
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.dayId).toBe("d2");
    await waitFor(() =>
      expect(screen.getByText("Cafe Near was added to Day 2.")).toBeTruthy()
    );
  });

  it("searches around the stop it was opened for, and leaves out places planned on other days", async () => {
    // D is about 11 km north of the stops of Day 1. Cafe D and the place of B are near D.
    const farStops = stops.map((item) =>
      item.id === "D"
        ? { ...item, place: { ...item.place, latitude: 41.2 } }
        : item
    );
    const nearD: PlaceItem[] = [
      { ...nearby[0], id: "cafe-d", name: "Cafe D", latitude: 41.203 },
      { ...nearby[1], latitude: 41.201 },
    ];
    render(
      <ItineraryEditor
        {...base}
        initialStops={farStops}
        cityPlaces={[...cityPlaces, nearby[0], ...nearD]}
      />
    );
    await chooseDay(2);
    await openNearby("Place D");

    expect(
      screen.getByRole("heading", { level: 2, name: "Near Place D" })
    ).toBeTruthy();
    const list = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(list).toEqual(["Cafe D"]);
  });

  it("starts with All types when Nearby is opened for another stop", async () => {
    render(<ItineraryEditor {...props} />);
    await openNearby("Place A");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "CAFE");

    await openNearby("Place B");

    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("");
  });

  it("cannot add a second time while the first add is saving", async () => {
    let release: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => (release = resolve))
    );
    render(<ItineraryEditor {...props} />);
    await openNearby("Place A");
    const add = screen.getByRole("button", {
      name: "Add to Day 1 (Cafe Near)",
    }) as HTMLButtonElement;

    await userEvent.click(add);

    expect(add.disabled).toBe(true);
    release(json({ stops }));
    await waitFor(() => expect(add.disabled).toBe(false));
  });

  it("says the place was added, and puts the focus back on the type filter", async () => {
    render(<ItineraryEditor {...props} />);
    await openNearby("Place A");

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 1 (Cafe Near)" })
    );

    await waitFor(() =>
      expect(screen.getByText("Cafe Near was added to Day 1.")).toBeTruthy()
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Type"))
    );
  });

  it("goes back to the map when the stop is gone", async () => {
    const { rerender } = render(<ItineraryEditor {...props} />);
    await openNearby("Place A");

    rerender(
      <ItineraryEditor
        {...props}
        initialStops={stops.filter((item) => item.id !== "A")}
      />
    );

    expect(screen.queryByRole("tab", { name: "Nearby" })).toBeNull();
    expect(tab("Map").getAttribute("aria-selected")).toBe("true");
  });
});
