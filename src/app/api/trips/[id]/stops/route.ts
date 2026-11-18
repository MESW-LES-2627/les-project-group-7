import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { placeNewStop } from "@/domain/itinerary/stop-order";
import { parseVisitTime } from "@/domain/itinerary/visit-time";
import {
  loadItinerary,
  listStops,
  readJsonObject,
  refusalResponse,
  savePlacements,
  stopsFailure,
  stopsResponse,
  STOPS_TRANSACTION,
  tripNotFound,
} from "@/lib/trip-stops";

/**
 * POST /api/trips/[id]/stops
 *
 * Adds a place to a day of a trip as the last stop of that day (US-E4-01, #60). Needs a logged-in user
 * (401 without one, 403 for a request from another site) and a trip that is the user's.
 *
 * Body: `dayId`, `placeId` and, if wanted, `visitTime` ("HH:mm").
 *
 * - 201 with the new `stop` and the `stops` of the trip in order (by day, then by position).
 * - 400 with `errors` for a missing or wrong field, or `reason` when the rules refuse: the day is not
 *   a day of the trip (`UNKNOWN_DAY`) or the place is in another city (`OTHER_CITY`, AC6).
 * - 404 when there is no such trip, or it is another user's: the same answer for both.
 * - 409 when the place is already in the trip (`ALREADY_PLANNED`, AC5), on any day.
 *
 * The visit time is any time of the day. The hour limits of the itinerary are never read: they only
 * warn, they never block (AC7, AC8). Everything is saved in one transaction.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;

    const body = await readJsonObject(request);
    if (body === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const dayId = typeof body.dayId === "string" ? body.dayId.trim() : "";
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const visitTime = parseVisitTime(body.visitTime);

    const errors: Record<string, string> = {};
    if (dayId === "") errors.dayId = "Choose the day";
    if (placeId === "") errors.placeId = "Choose the place";
    if (!visitTime.ok) errors.visitTime = visitTime.error;

    if (Object.keys(errors).length > 0 || !visitTime.ok) {
      const [firstError] = Object.values(errors);
      return NextResponse.json({ error: firstError, errors }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const state = await loadItinerary(tx, id, guard.user.id);
      if (state === null) {
        return { kind: "no-trip" } as const;
      }

      const place = await tx.place.findUnique({
        where: { id: placeId },
        select: { id: true, cityId: true },
      });
      if (place === null) {
        return { kind: "no-place" } as const;
      }

      const placed = placeNewStop(state.stops, state.layout, place, dayId);
      if (!placed.ok) {
        return { kind: "refused", failure: placed } as const;
      }

      await savePlacements(tx, placed.changes);

      const stop = await tx.itineraryStop.create({
        data: {
          itineraryId: state.itineraryId,
          dayId,
          placeId,
          position: placed.position,
          visitTime: visitTime.value,
        },
        select: {
          id: true,
          dayId: true,
          placeId: true,
          position: true,
          visitTime: true,
        },
      });

      return {
        kind: "added",
        stop,
        stops: await listStops(tx, state.itineraryId),
      } as const;
    }, STOPS_TRANSACTION);

    switch (result.kind) {
      case "no-trip":
        return tripNotFound();
      case "no-place":
        return NextResponse.json(
          {
            error: "This place does not exist",
            errors: { placeId: "This place does not exist" },
          },
          { status: 400 }
        );
      case "refused":
        return refusalResponse(result.failure);
      case "added":
        return stopsResponse(result.stop, result.stops, 201);
    }
  } catch (error) {
    return stopsFailure(error, "add the stop");
  }
}
