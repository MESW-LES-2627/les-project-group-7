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

describe("ItineraryEditor: the strip of days", () => {
  it("is positioned, so the screen-reader labels inside it do not widen the page", () => {
    const { container } = render(<ItineraryEditor {...base} />);

    expect(container.querySelector("ol.snap-x")?.className).toMatch(
      /\brelative\b/
    );
  });

  it("has one column for each day", () => {
    const { container } = render(<ItineraryEditor {...base} />);

    expect(container.querySelectorAll("ol.snap-x > li")).toHaveLength(3);
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
    await userEvent.type(screen.getByLabelText("Place"), "Lou");
    await userEvent.click(await screen.findByText("Louvre"));
  }

  it("is the day that was chosen", async () => {
    fetchMock.mockImplementation(async () => json({ stops }));
    render(<ItineraryEditor {...base} />);

    await userEvent.selectOptions(screen.getByLabelText("Day"), "d3");
    await addLouvre();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
        .dayId
    ).toBe("d3");
  });

  it("falls back to the first day when the chosen day is gone (the trip was made shorter)", async () => {
    const view = render(<ItineraryEditor {...base} />);
    await userEvent.selectOptions(screen.getByLabelText("Day"), "d3");

    // The Edit trip dialog shortens the trip and the page reads its data again
    view.rerender(
      <ItineraryEditor
        {...base}
        days={days.slice(0, 2)}
        initialStops={stops.filter((item) => item.dayId !== "d3")}
      />
    );

    expect((screen.getByLabelText("Day") as HTMLSelectElement).value).toBe(
      "d1"
    );

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
    await userEvent.selectOptions(screen.getByLabelText("Day"), "d2");

    view.rerender(<ItineraryEditor {...base} initialStops={[...stops]} />);

    expect((screen.getByLabelText("Day") as HTMLSelectElement).value).toBe(
      "d2"
    );
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
  it("shows the stops it is given again, and drops the ones that are gone", () => {
    const view = render(<ItineraryEditor {...base} />);
    expect(screen.getByText("Place D")).toBeTruthy();

    view.rerender(
      <ItineraryEditor
        {...base}
        initialStops={stops.filter((item) => item.id !== "D")}
      />
    );

    expect(screen.queryByText("Place D")).toBeNull();
    expect(screen.getByText("Place A")).toBeTruthy();
  });

  it("forgets the unsaved time of a stop that is gone", async () => {
    const view = render(<ItineraryEditor {...base} />);
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

    expect(screen.queryByText(/Your saved places in/)).toBeNull();
  });
});
