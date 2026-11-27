/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { PlaceCategory } from "@prisma/client";
import { usePlaceReviews } from "./usePlaceReviews";
import type { PlaceItem } from "@/components/PlaceExplorer";
import { NETWORK_ERROR } from "@/domain/reviews/review-form";

afterEach(() => vi.unstubAllGlobals());

const place = (id: string): PlaceItem => ({
  id,
  name: `Place ${id}`,
  category: PlaceCategory.MUSEUM,
  address: "Porto",
  latitude: 41.1,
  longitude: -8.6,
  averageRating: null,
  reviewCount: 0,
});

const json = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

const review = (id: string) => ({
  id,
  rating: 4,
  text: "Nice",
  createdAt: "2026-11-01T10:00:00.000Z",
  user: { username: "rui" },
});

function setup() {
  return renderHook(() =>
    usePlaceReviews({ currentUsername: "ana", onPlaceUpdated: () => {} })
  );
}

describe("usePlaceReviews: loading the reviews of a place (#187)", () => {
  it("does not show the reviews of the place opened before while the next one loads", async () => {
    let answerB: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json([review("a1"), review("a2")]))
        .mockImplementationOnce(() => new Promise((r) => (answerB = r)))
    );
    const { result } = setup();

    act(() => result.current.openReviewModal(place("A")));
    await waitFor(() => expect(result.current.reviewsList).toHaveLength(2));

    act(() => result.current.openReviewModal(place("B")));
    expect(result.current.reviewsList).toEqual([]);
    expect(result.current.isLoadingReviews).toBe(true);

    await act(async () => answerB(json([review("b1")])));
    expect(result.current.reviewsList.map((r) => r.id)).toEqual(["b1"]);
  });

  it("says the load failed, instead of an empty list, when the server answers an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, false)));
    const { result } = setup();

    act(() => result.current.openReviewModal(place("A")));

    await waitFor(() => expect(result.current.reviewsFailed).toBe(true));
    expect(result.current.isLoadingReviews).toBe(false);
  });

  it("says the load failed when the server cannot be reached, and tries again on request", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json([review("a1")]));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = setup();

    act(() => result.current.openReviewModal(place("A")));
    await waitFor(() => expect(result.current.reviewsFailed).toBe(true));

    act(() => result.current.retryReviews());
    await waitFor(() => expect(result.current.reviewsList).toHaveLength(1));
    expect(result.current.reviewsFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("usePlaceReviews: posting a review (#187, AC3)", () => {
  async function postWith(answer: () => Promise<unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json([])).mockImplementationOnce(answer)
    );
    const { result } = setup();
    act(() => result.current.openReviewModal(place("A")));
    await waitFor(() => expect(result.current.isLoadingReviews).toBe(false));
    await act(() => result.current.handleSubmitReview(4, "Nice", "€"));
    return result.current;
  }

  it("says the server could not be reached, not the browser's words", async () => {
    const state = await postWith(() =>
      Promise.reject(new TypeError("Failed to fetch"))
    );

    expect(state.errorMsg).toBe(NETWORK_ERROR);
    expect(state.isSubmitting).toBe(false);
  });

  it("passes the server's message on", async () => {
    const state = await postWith(async () =>
      json({ error: "You have already reviewed this place" }, false)
    );

    expect(state.errorMsg).toBe("You have already reviewed this place");
  });

  it("gives a plain message when the server sends none, or no JSON at all", async () => {
    const state = await postWith(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));

    expect(state.errorMsg).toBe("Could not post the review, try again");
  });
});
