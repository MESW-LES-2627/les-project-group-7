import {
  isSavedPlaceType,
  type SavedPlace,
  type SavedPlaceType,
} from "@/domain/saved-places/saved-places";

/**
 * Calls of the Saved places API.
 *
 * - `GET    /api/saved-places`
 * - `POST   /api/saved-places`  → 201 (409 when it was already saved, 404 when the place does not exist)
 * - `DELETE /api/saved-places`  → 204 (404 when it was not saved)
 *
 * All of them answer 401 when nobody is logged in. `type` is `WISHLIST` or `BOOKMARK`.
 */
export const SAVED_PLACES_API = "/api/saved-places";

export type SavedPlacesResult =
  { ok: true; saved: SavedPlace[] } | { ok: false; message: string };

export type SaveChangeResult = { ok: true } | { ok: false; message: string };

const SESSION_EXPIRED = "Your session expired. Log in again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseSavedPlaces(body: unknown): SavedPlace[] | null {
  if (!Array.isArray(body)) {
    return null;
  }

  const saved: SavedPlace[] = [];
  for (const item of body) {
    if (!isRecord(item) || !isRecord(item.place)) continue;

    const { place } = item;
    if (
      !isSavedPlaceType(item.type) ||
      typeof item.savedAt !== "string" ||
      typeof place.id !== "string" ||
      typeof place.name !== "string"
    ) {
      continue;
    }

    const city = isRecord(place.city) ? place.city : null;

    saved.push({
      type: item.type,
      savedAt: item.savedAt,
      place: {
        id: place.id,
        name: place.name,
        category: optionalText(place.category) ?? "OTHER",
        address: optionalText(place.address),
        averageRating: optionalNumber(place.averageRating),
        reviewCount: optionalNumber(place.reviewCount) ?? 0,
        priceLevel: optionalText(place.priceLevel),
        city:
          city &&
          typeof city.name === "string" &&
          typeof city.country === "string"
            ? { name: city.name, country: city.country }
            : null,
      },
    });
  }

  return saved;
}

export async function fetchSavedPlaces(): Promise<SavedPlacesResult> {
  const failed = {
    ok: false,
    message: "Could not load your saved places. Please try again.",
  } as const;

  try {
    const response = await fetch(SAVED_PLACES_API, { cache: "no-store" });

    if (response.status === 401) {
      return { ok: false, message: SESSION_EXPIRED };
    }
    if (!response.ok) {
      return failed;
    }

    const saved = parseSavedPlaces(await response.json().catch(() => null));
    return saved ? { ok: true, saved } : failed;
  } catch {
    return failed;
  }
}

export async function savePlace(
  placeId: string,
  type: SavedPlaceType
): Promise<SaveChangeResult> {
  const failed = {
    ok: false,
    message: "Could not save the place. Please try again.",
  } as const;

  try {
    const response = await fetch(SAVED_PLACES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, type }),
    });

    if ([200, 201, 409].includes(response.status)) {
      return { ok: true };
    }
    if (response.status === 401) {
      return { ok: false, message: SESSION_EXPIRED };
    }
    if (response.status === 404) {
      return { ok: false, message: "This place does not exist any more." };
    }
    return failed;
  } catch {
    return failed;
  }
}

export async function removeSavedPlace(
  placeId: string,
  type: SavedPlaceType
): Promise<SaveChangeResult> {
  const failed = {
    ok: false,
    message: "Could not remove the place. Please try again.",
  } as const;

  try {
    const response = await fetch(SAVED_PLACES_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId, type }),
    });

    if ([200, 204, 404].includes(response.status)) {
      return { ok: true };
    }
    if (response.status === 401) {
      return { ok: false, message: SESSION_EXPIRED };
    }
    return failed;
  } catch {
    return failed;
  }
}
