/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SavePlaceButtons from "./SavePlaceButtons";

const useSavedPlaces = vi.fn();
vi.mock("./SavedPlacesProvider", () => ({
  useSavedPlaces: () => useSavedPlaces(),
}));

afterEach(cleanup);

const LELLO = { id: "lello", name: "Livraria Lello", category: "MUSEUM" };

function setup(pending: boolean) {
  const toggle = vi.fn();
  useSavedPlaces.mockReturnValue({
    status: "ready",
    isSaved: () => false,
    isPending: () => pending,
    toggle,
  });
  render(<SavePlaceButtons place={LELLO} />);
  return toggle;
}

describe("SavePlaceButtons while a request runs", () => {
  it("keeps the focus on the button: it is aria-disabled, not disabled", async () => {
    setup(true);
    const button = screen.getByRole("button", {
      name: "Add to wishlist: Livraria Lello",
    });

    button.focus();

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("ignores a click while the request runs", async () => {
    const toggle = setup(true);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to wishlist: Livraria Lello" })
    );

    expect(toggle).not.toHaveBeenCalled();
  });

  it("saves the place on a click when nothing is running", async () => {
    const toggle = setup(false);

    await userEvent.click(
      screen.getByRole("button", { name: "Add to wishlist: Livraria Lello" })
    );

    expect(toggle).toHaveBeenCalledWith(LELLO, "WISHLIST");
  });
});
