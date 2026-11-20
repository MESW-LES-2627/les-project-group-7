/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlannerSavedPlaces from "./PlannerSavedPlaces";

const useSavedPlaces = vi.fn();
vi.mock("@/components/SavedPlacesProvider", () => ({
  useSavedPlaces: () => useSavedPlaces(),
}));

afterEach(cleanup);

const entry = (id: string, type: "WISHLIST" | "BOOKMARK") => ({
  type,
  savedAt: "2026-11-01T10:00:00Z",
  place: { id, name: `Place ${id}`, category: "PARK", reviewCount: 2 },
});

function setup(saved: ReturnType<typeof entry>[], planned: string[] = []) {
  useSavedPlaces.mockReturnValue({ status: "ready", saved, reload: vi.fn() });
  const onAdd = vi.fn();
  render(
    <PlannerSavedPlaces
      cityName="Porto"
      cityPlaceIds={new Set(["a", "b"])}
      plannedIds={new Set(planned)}
      dayLabel="Day 2"
      disabled={false}
      onAdd={onAdd}
    />
  );
  return onAdd;
}

describe("PlannerSavedPlaces", () => {
  it("adds a saved place of the city to the chosen day", async () => {
    const onAdd = setup([entry("a", "WISHLIST")]);

    await userEvent.click(
      screen.getByRole("button", { name: "Add Place a to Day 2" })
    );

    expect(onAdd).toHaveBeenCalledWith("a");
  });

  it("says Planned, with no button, for a place already on the trip", () => {
    setup([entry("a", "WISHLIST")], ["a"]);

    expect(screen.getByText("Planned")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add Place a/ })).toBeNull();
  });

  it("only counts a saved place of another city", () => {
    setup([entry("far", "BOOKMARK")]);

    expect(screen.getByText("1 saved place is in another city.")).toBeTruthy();
    expect(screen.queryByText("Place far")).toBeNull();
  });

  it("shows nothing outside the provider", () => {
    useSavedPlaces.mockReturnValue(null);
    const { container } = render(
      <PlannerSavedPlaces
        cityName="Porto"
        cityPlaceIds={new Set()}
        plannedIds={new Set()}
        dayLabel="Day 1"
        disabled={false}
        onAdd={vi.fn()}
      />
    );

    expect(container.innerHTML).toBe("");
  });
});
