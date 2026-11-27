import { describe, it, expect } from "vitest";
import {
  NETWORK_ERROR,
  PRICE_LEVEL_MISSING,
  RATING_MISSING,
  TEXT_MISSING,
  failureMessage,
  reviewFormErrors,
} from "./review-form";

describe("reviewFormErrors: what is missing in a review form (#187, AC3)", () => {
  it("has no error when the rating, the price level and the text are given", () => {
    expect(
      reviewFormErrors({ rating: 4, priceLevel: "€€", text: "Nice" })
    ).toEqual({});
  });

  it("names each missing field with what to do", () => {
    expect(
      reviewFormErrors({ rating: null, priceLevel: null, text: "" })
    ).toEqual({
      rating: RATING_MISSING,
      priceLevel: PRICE_LEVEL_MISSING,
      text: TEXT_MISSING,
    });
  });

  it("reads a text of only spaces as missing", () => {
    expect(
      reviewFormErrors({ rating: 5, priceLevel: "FREE", text: "   \n " })
    ).toEqual({ text: TEXT_MISSING });
  });

  it("does not ask for a price level when the form does not require one (editing an old review)", () => {
    expect(
      reviewFormErrors(
        { rating: 3, priceLevel: null, text: "Fine" },
        { priceLevelRequired: false }
      )
    ).toEqual({});
  });

  it("refuses a rating outside 1 to 5", () => {
    for (const rating of [0, 6, 2.5]) {
      expect(
        reviewFormErrors({ rating, priceLevel: "€", text: "Ok" }).rating
      ).toBe(RATING_MISSING);
    }
  });
});

describe("failureMessage: the message of a request that failed (#187, AC3)", () => {
  it("uses the message of the server when it sends one", () => {
    expect(
      failureMessage({ error: "You have already reviewed this place" }, "x")
    ).toBe("You have already reviewed this place");
  });

  it("falls back to the message of the action when the server sends none", () => {
    expect(failureMessage(null, "Could not post the review, try again")).toBe(
      "Could not post the review, try again"
    );
    expect(failureMessage({ error: "" }, "fallback")).toBe("fallback");
    expect(failureMessage({ other: 1 }, "fallback")).toBe("fallback");
  });

  it("says the server could not be reached, not the words of the browser, when the request did not get through", () => {
    expect(failureMessage(new TypeError("Failed to fetch"), "fallback")).toBe(
      NETWORK_ERROR
    );
  });
});
