import { describe, it, expect } from "vitest";
import {
  ALREADY_REVIEWED_MESSAGE,
  hasReviewedPlace,
  isRepeatedReviewError,
} from "./one-review-rule";

describe("isRepeatedReviewError", () => {
  it("recognises the refusal of a second review, with the columns or with the index name", () => {
    expect(
      isRepeatedReviewError({
        code: "P2002",
        meta: { target: ["userId", "placeId"] },
      })
    ).toBe(true);
    expect(
      isRepeatedReviewError({
        code: "P2002",
        meta: { target: "Review_userId_placeId_key" },
      })
    ).toBe(true);
  });

  it("needs both columns: the user and the place", () => {
    expect(
      isRepeatedReviewError({ code: "P2002", meta: { target: ["userId"] } })
    ).toBe(false);
    expect(
      isRepeatedReviewError({ code: "P2002", meta: { target: ["placeId"] } })
    ).toBe(false);
  });

  it("only takes the unique violation code for it", () => {
    expect(
      isRepeatedReviewError({
        code: "P2025",
        meta: { target: ["userId", "placeId"] },
      })
    ).toBe(false);
  });

  it("does not take another unique violation for it", () => {
    expect(
      isRepeatedReviewError({ code: "P2002", meta: { target: ["email"] } })
    ).toBe(false);
    expect(
      isRepeatedReviewError({
        code: "P2002",
        meta: { target: "Place_osmId_key" },
      })
    ).toBe(false);
    expect(isRepeatedReviewError({ code: "P2002" })).toBe(false);
  });

  it("does not take another error for it", () => {
    expect(isRepeatedReviewError({ code: "P2025" })).toBe(false);
    expect(isRepeatedReviewError(new Error("boom"))).toBe(false);
    expect(isRepeatedReviewError(null)).toBe(false);
    expect(isRepeatedReviewError("P2002")).toBe(false);
  });
});

describe("hasReviewedPlace", () => {
  const reviews = [
    { user: { username: "ana_exploradora" } },
    { user: { username: "rui_gastronomo" } },
    { user: null },
    {},
  ];

  it("finds a review of the user, whatever the case of the name", () => {
    expect(hasReviewedPlace(reviews, "ana_exploradora")).toBe(true);
    expect(hasReviewedPlace(reviews, "Ana_Exploradora")).toBe(true);
  });

  it("finds it when the review has the name in another case too", () => {
    expect(
      hasReviewedPlace(
        [{ user: { username: "Ana_Exploradora" } }],
        "ana_exploradora"
      )
    ).toBe(true);
  });

  it("never takes an empty name for a user", () => {
    expect(hasReviewedPlace([{ user: { username: "" } }], "")).toBe(false);
  });

  it("is false for a user without a review of the place, and for nobody", () => {
    expect(hasReviewedPlace(reviews, "viajante_porto")).toBe(false);
    expect(hasReviewedPlace(reviews, null)).toBe(false);
    expect(hasReviewedPlace(reviews, "")).toBe(false);
    expect(hasReviewedPlace([], "ana_exploradora")).toBe(false);
  });
});

describe("ALREADY_REVIEWED_MESSAGE", () => {
  it("tells the user to edit the review instead (US-C1-01 AC3)", () => {
    expect(ALREADY_REVIEWED_MESSAGE).toMatch(/already reviewed/i);
    expect(ALREADY_REVIEWED_MESSAGE).toMatch(/edit your review/i);
  });
});
