import { SavedPlaceType } from "@prisma/client";

export type SavedPlaceInput = {
  placeId: string;
  type: SavedPlaceType;
};

type ValidationResult =
  | { ok: true; value: SavedPlaceInput }
  | { ok: false; errors: Record<string, string> };

export function validateSavedPlaceInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      errors: { body: "Invalid request body" },
    };
  }

  const input = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const placeId = typeof input.placeId === "string" ? input.placeId.trim() : "";

  if (!placeId) {
    errors.placeId = "placeId is required";
  }

  if (
    input.type !== SavedPlaceType.WISHLIST &&
    input.type !== SavedPlaceType.BOOKMARK
  ) {
    errors.type = "type must be WISHLIST or BOOKMARK";
  }

  if ("userId" in input) {
    errors.userId = "userId cannot be provided";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      placeId,
      type: input.type as SavedPlaceType,
    },
  };
}
