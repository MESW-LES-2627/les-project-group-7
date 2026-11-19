/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceLevelField, RatingField } from "./ReviewFields";

afterEach(() => cleanup());

const pressed = (name: string | RegExp) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed");

describe("RatingField", () => {
  it("shows the five ratings, with none selected until there is a value", () => {
    render(<RatingField value={null} onChange={() => {}} />);

    for (const rating of [1, 2, 3, 4, 5]) {
      expect(pressed(`${rating} ★`)).toBe("false");
    }
  });

  it("marks the current rating as pressed", () => {
    render(<RatingField value={4} onChange={() => {}} />);

    expect(pressed("4 ★")).toBe("true");
    expect(pressed("3 ★")).toBe("false");
  });

  it("gives the rating that is clicked", async () => {
    const onChange = vi.fn();
    render(<RatingField value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "5 ★" }));

    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("cannot be clicked when it is disabled", async () => {
    const onChange = vi.fn();
    render(<RatingField value={2} onChange={onChange} disabled />);

    await userEvent.click(screen.getByRole("button", { name: "5 ★" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("is a group named Rating, with the red mark only when it is required", () => {
    const { rerender } = render(
      <RatingField value={null} onChange={() => {}} />
    );
    expect(screen.getByRole("group", { name: "Rating" })).toBeTruthy();
    expect(screen.queryByText("*")).toBeNull();

    rerender(<RatingField value={null} onChange={() => {}} required />);
    expect(screen.getByText("*")).toBeTruthy();
  });
});

describe("PriceLevelField", () => {
  it("shows Free and the three prices, with none selected until there is a value", () => {
    render(<PriceLevelField value={null} onChange={() => {}} />);

    for (const name of [/free/i, /^€$/, /^€\s?€$/, /^€\s?€\s?€$/]) {
      expect(pressed(name)).toBe("false");
    }
  });

  it("marks the current price level as pressed", () => {
    render(<PriceLevelField value="€€" onChange={() => {}} />);

    expect(pressed(/^€\s?€$/)).toBe("true");
    expect(pressed(/^€$/)).toBe("false");
  });

  it("gives the price level that is clicked", async () => {
    const onChange = vi.fn();
    render(<PriceLevelField value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /^€\s?€\s?€$/ }));
    await userEvent.click(screen.getByRole("button", { name: /free/i }));

    expect(onChange).toHaveBeenNthCalledWith(1, "€€€");
    expect(onChange).toHaveBeenNthCalledWith(2, "FREE");
  });

  it("cannot be clicked when it is disabled, and is a group named Price level", async () => {
    const onChange = vi.fn();
    render(<PriceLevelField value={null} onChange={onChange} disabled />);

    await userEvent.click(screen.getByRole("button", { name: /^€$/ }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Price level" })).toBeTruthy();
  });
});
