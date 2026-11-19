import { describe, it, expect } from "vitest";
import { SavedPlaceType } from "@prisma/client";
import { validateSavedPlaceInput } from "./saved-place-validation";

describe("validateSavedPlaceInput", () => {
  it("accepts a valid wishlist entry", () => {
    const result = validateSavedPlaceInput({
      placeId: "place-1",
      type: SavedPlaceType.WISHLIST,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        placeId: "place-1",
        type: SavedPlaceType.WISHLIST,
      },
    });
  });

  it("accepts a valid bookmark entry", () => {
    const result = validateSavedPlaceInput({
      placeId: "place-1",
      type: SavedPlaceType.BOOKMARK,
    });

    expect(result.ok).toBe(true);
  });

  it("trims whitespace from placeId", () => {
    const result = validateSavedPlaceInput({
      placeId: "  place-1  ",
      type: SavedPlaceType.WISHLIST,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        placeId: "place-1",
        type: SavedPlaceType.WISHLIST,
      },
    });
  });

  it("rejects a missing placeId", () => {
    const result = validateSavedPlaceInput({
      type: SavedPlaceType.WISHLIST,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.placeId).toBeDefined();
    }
  });

  it("rejects an empty placeId", () => {
    const result = validateSavedPlaceInput({
      placeId: "   ",
      type: SavedPlaceType.WISHLIST,
    });

    expect(result.ok).toBe(false);
  });

  it("rejects an invalid saved place type", () => {
    const result = validateSavedPlaceInput({
      placeId: "place-1",
      type: "FAVORITE",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.type).toBeDefined();
    }
  });

  it("rejects a userId supplied by the client", () => {
    const result = validateSavedPlaceInput({
      placeId: "place-1",
      type: SavedPlaceType.WISHLIST,
      userId: "another-user",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.userId).toBeDefined();
    }
  });

  it("rejects null and arrays", () => {
    expect(validateSavedPlaceInput(null).ok).toBe(false);
    expect(validateSavedPlaceInput([]).ok).toBe(false);
  });

  it("rejects an invalid body", () => {
    expect(validateSavedPlaceInput("invalid").ok).toBe(false);
  });
});
