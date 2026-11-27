/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaceCategory } from "@prisma/client";
import ReviewModal, { type ReviewItem } from "./ReviewModal";
import type { PlaceItem } from "./PlaceExplorer";
import {
  PRICE_LEVEL_MISSING,
  RATING_MISSING,
  TEXT_MISSING,
} from "@/domain/reviews/review-form";

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
    isLoadingReviews?: boolean;
    reviewsFailed?: boolean;
    onRetryReviews?: () => void;
    isSubmitting?: boolean;
    errorMessage?: string | null;
    onSubmit?: () => void;
  } = {}
) {
  return render(
    <ReviewModal
      place={props.place ?? place()}
      currentUsername={props.username === undefined ? "ana" : props.username}
      showPlaceLink={props.showPlaceLink}
      reviews={props.reviews ?? []}
      isLoadingReviews={props.isLoadingReviews ?? false}
      reviewsFailed={props.reviewsFailed}
      onRetryReviews={props.onRetryReviews}
      isSubmitting={props.isSubmitting ?? false}
      submitSuccess={null}
      errorMessage={props.errorMessage ?? null}
      onClose={() => {}}
      onSubmit={props.onSubmit ?? (() => {})}
    />
  );
}

const postButton = () =>
  screen.getByRole("button", { name: /post review/i }) as HTMLButtonElement;

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

    expect(screen.getByText(/Recent reviews \(3\)/)).toBeTruthy();
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

  it("starts with nothing chosen and the post button ready to press (#187)", () => {
    renderModal();

    expect(
      screen.getByRole("button", { name: "4 ★" }).getAttribute("aria-pressed")
    ).toBe("false");
    expect(postButton().disabled).toBe(false);
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
    await user.click(postButton());

    expect(onSubmit).toHaveBeenCalledWith(4, "Great place", "€€");
  });
});

describe("ReviewModal: what is missing is said next to the field (#187, AC3)", () => {
  it("shows no message before the first try to post", () => {
    renderModal();

    expect(screen.queryByText(RATING_MISSING)).toBeNull();
    expect(screen.queryByText(TEXT_MISSING)).toBeNull();
  });

  it("names every missing field under it, sends nothing, and moves the focus to the first one", async () => {
    const onSubmit = vi.fn();
    renderModal({ onSubmit });
    const user = userEvent.setup();

    await user.click(postButton());

    expect(onSubmit).not.toHaveBeenCalled();
    const rating = screen.getByRole("group", { name: /^Rating/ });
    expect(within(rating).getByText(RATING_MISSING)).toBeTruthy();
    expect(rating.getAttribute("aria-describedby")).toBe("review-rating-error");
    expect(
      within(screen.getByRole("group", { name: /^Price level/ })).getByText(
        PRICE_LEVEL_MISSING
      )
    ).toBeTruthy();
    expect(screen.getByText(TEXT_MISSING)).toBeTruthy();
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(
      "review-comment-error"
    );
    expect(document.activeElement?.textContent).toBe("1 ★");
  });

  it("takes a message away as soon as its field is given, and focuses the next missing one", async () => {
    renderModal();
    const user = userEvent.setup();

    await user.click(postButton());
    await user.click(screen.getByRole("button", { name: "5 ★" }));
    await user.click(screen.getByRole("button", { name: /free/i }));

    expect(screen.queryByText(RATING_MISSING)).toBeNull();
    expect(screen.queryByText(PRICE_LEVEL_MISSING)).toBeNull();
    expect(screen.getByText(TEXT_MISSING)).toBeTruthy();

    await user.click(postButton());
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it("reads a text of only spaces as missing", async () => {
    const onSubmit = vi.fn();
    renderModal({ onSubmit });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "3 ★" }));
    await user.click(screen.getByRole("button", { name: /free/i }));
    await user.type(screen.getByRole("textbox"), "    ");
    await user.click(postButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(TEXT_MISSING)).toBeTruthy();
  });
});

describe("ReviewModal: while the review is posted (#187, AC1)", () => {
  it("says it is posting and locks the fields and both buttons", () => {
    renderModal({ isSubmitting: true });

    const posting = screen.getByRole("button", { name: /posting…/i });
    expect((posting as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "4 ★" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      true
    );
  });

  it("shows a failure next to the buttons, announced to screen readers", () => {
    renderModal({ errorMessage: "Could not reach the server, try again" });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not reach the server");
    expect(alert.closest("form")).not.toBeNull();
  });
});

describe("ReviewModal: the list of reviews (#187, AC1, AC2, AC3)", () => {
  it("gives no count and no form while the reviews load, so it never says 0 or shows a form it may take away", () => {
    renderModal({ isLoadingReviews: true });

    expect(screen.getByText("Recent reviews").textContent).toBe(
      "Recent reviews"
    );
    expect(screen.getByRole("status").textContent).toBe("Loading reviews…");
    expect(screen.queryByRole("button", { name: /post review/i })).toBeNull();
  });

  it("says the reviews could not be loaded instead of saying there are none, and can try again", async () => {
    const onRetryReviews = vi.fn();
    renderModal({ reviewsFailed: true, onRetryReviews });
    const user = userEvent.setup();

    expect(screen.queryByText(/No reviews yet/)).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "The reviews could not be loaded."
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryReviews).toHaveBeenCalledOnce();
  });

  it("uses the words of the page of the place when there are no reviews", () => {
    renderModal();

    expect(
      screen.getByText(
        "No reviews yet. Be the first to share your experience with this place."
      )
    ).toBeTruthy();
  });
});

describe("ReviewModal: the notice of a review already written", () => {
  it("shows the notice and no form to a user who already reviewed the place", () => {
    renderModal({ reviews: [review("1", "ana", "mine")] });

    expect(screen.queryByRole("button", { name: "4 ★" })).toBeNull();
    expect(screen.getByText(/already reviewed this place/i)).toBeTruthy();
  });
});
