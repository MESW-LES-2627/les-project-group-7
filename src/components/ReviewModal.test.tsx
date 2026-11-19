/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceCategory } from "@prisma/client";
import ReviewModal, { type ReviewItem } from "./ReviewModal";
import type { PlaceItem } from "./PlaceExplorer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => cleanup());

const place = (extra: Partial<PlaceItem> = {}): PlaceItem => ({
  id: "place-1",
  name: "Palácio da Bolsa",
  category: PlaceCategory.MONUMENT,
  address: "Rua de Ferreira Borges, Porto",
  latitude: 41.14,
  longitude: -8.61,
  averageRating: 4.5,
  reviewCount: 3,
  ...extra,
});

const review = (id: string, username: string, text: string): ReviewItem => ({
  id,
  rating: 4,
  priceLevel: "€€",
  text,
  createdAt: "2026-05-01T10:00:00.000Z",
  user: { username },
});

function renderModal(
  props: {
    place?: PlaceItem;
    username?: string | null;
    reviews?: ReviewItem[];
    showPlaceLink?: boolean;
  } = {}
) {
  return render(
    <ReviewModal
      place={props.place ?? place()}
      currentUsername={props.username === undefined ? "ana" : props.username}
      showPlaceLink={props.showPlaceLink}
      reviews={props.reviews ?? []}
      isLoadingReviews={false}
      isSubmitting={false}
      submitSuccess={null}
      errorMessage={null}
      onClose={() => {}}
      onSubmit={() => {}}
    />
  );
}

const reviewTexts = () =>
  screen
    .getAllByText(/^(newer|mine|older) review$/)
    .map((el) => el.textContent);

describe("ReviewModal: the page of the place", () => {
  it("has a button that opens the page of a place of the catalog", () => {
    renderModal();

    const link = screen.getByRole("link", { name: /open place page/i });

    expect(link.getAttribute("href")).toBe("/places/place-1");
  });

  it("has no such button on the page of the place itself, where it would lead nowhere new", () => {
    renderModal({ showPlaceLink: false });

    expect(screen.queryByRole("link", { name: /open place page/i })).toBeNull();
  });

  it("has no such button for a place that was only found on the map, which has no page", () => {
    renderModal({ place: place({ id: "osm-node-1", isDiscovered: true }) });

    expect(screen.queryByRole("link", { name: /open place page/i })).toBeNull();
  });
});

describe("ReviewModal: the review of the logged-in user comes first", () => {
  const reviews = [
    review("1", "rui", "newer review"),
    review("2", "ana", "mine review"),
    review("3", "eva", "older review"),
  ];

  it("shows the own review before the others and keeps their order", () => {
    renderModal({ reviews });

    expect(reviewTexts()).toEqual([
      "mine review",
      "newer review",
      "older review",
    ]);
  });

  it("compares the usernames without case", () => {
    renderModal({ reviews, username: "ANA" });

    expect(reviewTexts()[0]).toBe("mine review");
  });

  it("keeps the order when nobody is logged in", () => {
    renderModal({ reviews, username: null });

    expect(reviewTexts()).toEqual([
      "newer review",
      "mine review",
      "older review",
    ]);
  });

  it("still counts every review in the title", () => {
    renderModal({ reviews });

    expect(screen.getByText(/Recent Reviews \(3\)/)).toBeTruthy();
  });
});

describe("ReviewModal: the form that writes a review", () => {
  it("uses the same rating and price buttons as the dialog that edits a review", () => {
    renderModal();

    expect(screen.getByRole("group", { name: /^Rating/ })).toBeTruthy();
    expect(screen.getByRole("group", { name: /^Price level/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "3 ★" })).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("starts with nothing chosen and the submit button disabled", () => {
    renderModal();

    expect(
      screen.getByRole("button", { name: "4 ★" }).getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      (
        screen.getByRole("button", {
          name: /submit review/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("sends the rating, the comment and the price level that were chosen", async () => {
    const onSubmit = vi.fn();
    render(
      <ReviewModal
        place={place()}
        currentUsername="ana"
        reviews={[]}
        isLoadingReviews={false}
        isSubmitting={false}
        submitSuccess={null}
        errorMessage={null}
        onClose={() => {}}
        onSubmit={onSubmit}
      />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "4 ★" }));
    await user.click(screen.getByRole("button", { name: /^€\s?€$/ }));
    await user.type(screen.getByRole("textbox"), "  Great place  ");
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    expect(onSubmit).toHaveBeenCalledWith(4, "Great place", "€€");
  });

  it("keeps submit disabled until the rating, the price level and the text are all given", async () => {
    renderModal();
    const user = userEvent.setup();
    const submit = () =>
      screen.getByRole("button", {
        name: /submit review/i,
      }) as HTMLButtonElement;

    await user.click(screen.getByRole("button", { name: "5 ★" }));
    await user.type(screen.getByRole("textbox"), "Nice");
    expect(submit().disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /free/i }));
    expect(submit().disabled).toBe(false);
  });

  it("shows the notice and no form to a user who already reviewed the place", () => {
    renderModal({ reviews: [review("1", "ana", "mine")] });

    expect(screen.queryByRole("button", { name: "4 ★" })).toBeNull();
    expect(screen.getByText(/already reviewed this place/i)).toBeTruthy();
  });
});
