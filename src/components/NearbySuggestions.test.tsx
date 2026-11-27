/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NearbySuggestions from "./NearbySuggestions";
import type { PlaceItem } from "@/types/place";

afterEach(cleanup);

// 0.003 degrees north is about 334 m, 0.0135 about 1.5 km.
const ORIGIN = { latitude: 38.7139, longitude: -9.1394 };

function place(
  id: string,
  northDegrees: number,
  averageRating: number | null,
  category: PlaceItem["category"] = "RESTAURANT",
  reviewCount = 20
): PlaceItem {
  return {
    id,
    name: `Place ${id}`,
    category,
    address: "Rua A",
    latitude: ORIGIN.latitude + northDegrees,
    longitude: ORIGIN.longitude,
    averageRating,
    reviewCount,
  };
}

function setup(
  places: PlaceItem[],
  { planned = [] as string[], disabled = false } = {}
) {
  const onAdd = vi.fn();
  render(
    <NearbySuggestions
      originName="Livraria Lello"
      origin={ORIGIN}
      places={places}
      plannedIds={new Set(planned)}
      dayLabel="Day 2"
      disabled={disabled}
      onAdd={onAdd}
    />
  );
  return onAdd;
}

const names = () =>
  screen
    .getAllByRole("listitem")
    .map((item) => within(item).getByRole("heading", { level: 3 }).textContent);

describe("NearbySuggestions: AC1, the best rated first with distance and walking time", () => {
  const near = [
    place("ok", 0.005, 4.2),
    place("best", 0.003, 4.8),
    place("low", 0.008, 3.9),
  ];

  it("names the stop in the heading", () => {
    setup(near);

    expect(
      screen.getByRole("heading", { level: 2, name: "Near Livraria Lello" })
    ).toBeTruthy();
  });

  it("lists the places best rated first", () => {
    setup(near);

    expect(names()).toEqual(["Place best", "Place ok", "Place low"]);
  });

  it("shows each place with its rating, distance and walking time", () => {
    setup(near);

    const first = screen.getAllByRole("listitem")[0];

    expect(within(first).getByText("4.8")).toBeTruthy();
    // The number alone says nothing to a screen reader.
    expect(within(first).getByText("Rating:")).toBeTruthy();
    expect(within(first).getByText("20 reviews")).toBeTruthy();
    expect(within(first).getByText("334 m · 6 min walk")).toBeTruthy();
    expect(within(first).getByText("Restaurant")).toBeTruthy();
  });

  it("says only No rating yet for a place without a rating, not also No reviews yet", () => {
    setup([place("new", 0.003, null, "RESTAURANT", 0)]);

    expect(screen.getByText("No rating yet")).toBeTruthy();
    expect(screen.queryByText("No reviews yet")).toBeNull();
  });

  it("puts a place without a rating after the rated ones", () => {
    setup([
      place("new", 0.001, null, "RESTAURANT", 0),
      place("old", 0.004, 3.0),
    ]);

    expect(names()).toEqual(["Place old", "Place new"]);
  });

  it("says how many places there are, for people who cannot see the list change", () => {
    setup(near);

    expect(screen.getByRole("status").textContent).toBe(
      "3 places near Livraria Lello"
    );
  });
});

describe("NearbySuggestions: AC2, a type filter", () => {
  const mixed = [
    place("r", 0.003, 4.0, "RESTAURANT"),
    place("m", 0.002, 4.9, "MUSEUM"),
    place("c", 0.004, 4.5, "CAFE"),
  ];

  it("offers the types of the places of the city, and All types first", () => {
    setup(mixed);

    const options = within(screen.getByLabelText("Type")).getAllByRole(
      "option"
    );

    expect(options.map((o) => o.textContent)).toEqual([
      "All types",
      "Restaurant",
      "Museum",
      "Cafe",
    ]);
  });

  it("shows only the chosen type", async () => {
    setup(mixed);

    await userEvent.selectOptions(screen.getByLabelText("Type"), "Restaurant");

    expect(names()).toEqual(["Place r"]);
    expect(screen.getByRole("status").textContent).toBe(
      "1 place near Livraria Lello"
    );
  });

  it("shows every type again with All types", async () => {
    setup(mixed);
    await userEvent.selectOptions(screen.getByLabelText("Type"), "Restaurant");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "All types");

    expect(names()).toEqual(["Place m", "Place c", "Place r"]);
  });
});

describe("NearbySuggestions: AC3, add a suggestion to the day", () => {
  it("adds the place, and the button says which day", async () => {
    const onAdd = setup([place("a", 0.003, 4.0)]);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to Day 2 (Place a)" })
    );

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith("a");
  });

  it("cannot add while the plan is saving", () => {
    setup([place("a", 0.003, 4.0)], { disabled: true });

    expect(
      (
        screen.getByRole("button", {
          name: "Add to Day 2 (Place a)",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });
});

describe("NearbySuggestions: AC4, no place is near", () => {
  it("says so instead of an empty list", () => {
    setup([place("far", 0.0225, 5.0)]);

    expect(screen.queryByRole("list")).toBeNull();
    expect(
      screen.getByText("No places within 2 km of Livraria Lello.")
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "No places near Livraria Lello"
    );
  });

  it("tells to try another type when a type is chosen", async () => {
    setup([
      place("m", 0.003, 4.0, "MUSEUM"),
      place("far", 0.0225, 5.0, "PARK"),
    ]);

    await userEvent.selectOptions(screen.getByLabelText("Type"), "Park");

    expect(
      screen.getByText(
        "No places of this type within 2 km of Livraria Lello. Try another type."
      )
    ).toBeTruthy();
  });
});

describe("NearbySuggestions: AC5, places already in the trip", () => {
  it("are not suggested", () => {
    setup([place("a", 0.002, 5.0), place("b", 0.003, 4.0)], { planned: ["a"] });

    expect(names()).toEqual(["Place b"]);
  });
});

describe("NearbySuggestions: AC6, 1 km or 2 km", () => {
  it("shows no note when 3 places are within 1 km", () => {
    setup([
      place("a", 0.002, 3.0),
      place("b", 0.004, 3.5),
      place("c", 0.006, 4.0),
    ]);

    expect(screen.queryByText(/up to 2 km/)).toBeNull();
  });

  it("explains that the search widened when fewer than 3 are within 1 km", () => {
    setup([place("a", 0.002, 3.0), place("far", 0.0135, 4.0)]);

    expect(
      screen.getByText(
        "Fewer than 3 places within 1 km, so this shows places up to 2 km."
      )
    ).toBeTruthy();
    expect(screen.getByText("1.5 km · 26 min walk")).toBeTruthy();
  });
});

describe("NearbySuggestions: 10 places at a time", () => {
  /** 25 places within 1 km, p00 the best rated, p24 the last. */
  const many = (category: PlaceItem["category"] = "RESTAURANT") =>
    Array.from({ length: 25 }, (_, i) => ({
      ...place(
        `p${String(i).padStart(2, "0")}`,
        0.0001 * (i + 1),
        5 - i * 0.1,
        category
      ),
    }));

  it("shows the first 10, says how many there are, and offers the next page", () => {
    setup(many());

    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe("Place p00");
    expect(screen.getByText("Showing 1 to 10 of 25 places")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
  });

  it("goes to the next and the previous page", async () => {
    setup(many());
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(names()[0]).toBe("Place p10");
    expect(screen.getByText("Showing 11 to 20 of 25 places")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(names()).toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(names()[0]).toBe("Place p10");
  });

  it("keeps the focus on Next on the last page, where it does nothing", async () => {
    setup(many());
    const user = userEvent.setup();
    const next = screen.getByRole("button", { name: "Next page" });

    await user.click(next);
    await user.click(next);
    await user.click(next);

    expect(screen.getByText("Page 3 of 3")).toBeTruthy();
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(next);
  });

  it("goes back to the first page when the type changes", async () => {
    setup([
      ...many(),
      ...many("MUSEUM").map((p) => ({
        ...p,
        id: `m${p.id}`,
        name: `Museum ${p.id}`,
      })),
    ]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.selectOptions(
      screen.getByLabelText("Type"),
      screen.getByRole("option", { name: "Museum" })
    );

    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
    expect(names()[0]).toBe("Museum p00");
  });

  it("moves back a page when adding places empties the last one", async () => {
    const places = many();
    const view = (planned: string[]) => (
      <NearbySuggestions
        originName="Livraria Lello"
        origin={ORIGIN}
        places={places}
        plannedIds={new Set(planned)}
        dayLabel="Day 2"
        disabled={false}
        onAdd={() => {}}
      />
    );
    const result = render(view([]));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));

    result.rerender(view(["p20", "p21", "p22", "p23", "p24"]));

    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    expect(names()[0]).toBe("Place p10");
  });

  it("shows no page controls with 10 places or fewer", () => {
    setup(many().slice(0, 10));

    expect(names()).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("shows how many places there are, not only to screen readers", () => {
    setup(many());

    const status = screen.getByRole("status");
    expect(status.textContent).toBe("25 places near Livraria Lello");
    expect(status.className).not.toContain("sr-only");
  });

  it("does not say it twice when there is no place near", () => {
    setup([place("far", 0.05, 4.0)]);

    expect(screen.getByRole("status").className).toContain("sr-only");
    expect(
      screen.getByText("No places within 2 km of Livraria Lello.")
    ).toBeTruthy();
  });
});
