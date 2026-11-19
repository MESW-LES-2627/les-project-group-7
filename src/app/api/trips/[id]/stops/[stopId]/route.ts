import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import {
  moveStop,
  removeStop,
  setStopTime,
  type StopRuleFailure,
} from "@/domain/itinerary/stop-order";
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

type Context = { params: Promise<{ id: string; stopId: string }> };

const NOT_IN_ITINERARY: StopRuleFailure = {
  ok: false,
  reason: "STOP_NOT_FOUND",
  error: "This stop is not in the itinerary",
};

/**
 * PATCH /api/trips/[id]/stops/[stopId]
 *
 * Moves a stop and/or sets its visit time (US-E4-01, #60). Needs a logged-in user (401 without one,
 * 403 for a request from another site) and a trip that is the user's.
 *
 * Body, at least one of:
 * - `dayId` and/or `position`: where the stop goes. Without `position` the stop stays where it is in
 *   its own day, and goes last in another day, or, if it has a visit time, to its place among the
 *   stops that have a time. Without `dayId` it stays on its day. The stops in between move up or
 *   down, so the positions stay 1, 2, 3 without gaps (AC2).
 * - `visitTime`: "HH:mm", any time of the day (AC3, AC7, AC8). `null` clears it. The stop stays where it
 *   is unless the new time puts it out of the order of the times: then it goes to its place among the
 *   stops that have a time, after the last one with the same or an earlier time.
 *
 * The stops that have a time always stay in the order of their times; the stops without a time can be
 * anywhere between them.
 *
 * - 200 with the `stop` and the `stops` of the trip in order (by day, then by position).
 * - 400 with `errors` for a wrong field, or `reason` when the rules refuse: a day that is not of the
 *   trip (`UNKNOWN_DAY`), a position that is not from 1 to the end of the day (`INVALID_POSITION`),
 *   or a move that would put a stop with a time out of the order of the times (`TIME_ORDER`).
 * - 404 for a trip that does not exist or is not the user's, and for a stop that is not in it.
 *
 * The hour limits of the itinerary are never read. Everything is saved in one transaction.
 */
export async function PATCH(request: Request, { params }: Context) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id, stopId } = await params;

    const body = await readJsonObject(request);
    if (body === null) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const errors: Record<string, string> = {};

    const hasDay = "dayId" in body && body.dayId !== undefined;
    const hasPosition = "position" in body && body.position !== undefined;
    const hasTime = "visitTime" in body && body.visitTime !== undefined;

    if (!hasDay && !hasPosition && !hasTime) {
      return NextResponse.json(
        { error: "Send a day, a position or a visit time to change" },
        { status: 400 }
      );
    }

    const dayId = typeof body.dayId === "string" ? body.dayId.trim() : "";
    if (hasDay && dayId === "") errors.dayId = "Choose the day";

    if (hasPosition && !Number.isInteger(body.position)) {
      errors.position = "The position must be a whole number";
    }

    const visitTime = parseVisitTime(body.visitTime);
    if (hasTime && !visitTime.ok) errors.visitTime = visitTime.error;

    if (Object.keys(errors).length > 0) {
      const [firstError] = Object.values(errors);
      return NextResponse.json({ error: firstError, errors }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const state = await loadItinerary(tx, id, guard.user.id, {
        lock: true,
      });
      if (state === null) {
        return { kind: "no-trip" } as const;
      }

      const current = state.stops.find((stop) => stop.id === stopId);
      if (!current) {
        return { kind: "no-stop" } as const;
      }

      // The rules see the stop with the time it is going to have.
      const newTime = hasTime && visitTime.ok ? visitTime.value : null;
      const stopsWithTime = hasTime
        ? state.stops.map((stop) =>
            stop.id === stopId ? { ...stop, visitTime: newTime } : stop
          )
        : state.stops;

      const decision =
        hasDay || hasPosition
          ? moveStop(
              stopsWithTime,
              state.layout,
              stopId,
              hasDay ? dayId : current.dayId,
              hasPosition ? (body.position as number) : undefined
            )
          : hasTime
            ? setStopTime(state.stops, stopId, newTime)
            : ({ ok: true, changes: [] } as const);

      if (!decision.ok) {
        return { kind: "refused", failure: decision } as const;
      }

      await savePlacements(tx, decision.changes);

      if (hasTime) {
        await tx.itineraryStop.update({
          where: { id: stopId },
          data: { visitTime: newTime },
        });
      }

      const stops = await listStops(tx, state.itineraryId);
      const stop = stops.find((item) => item.id === stopId);
      if (!stop) {
        throw new Error("The stop disappeared while it was being changed");
      }

      return { kind: "changed", stop, stops } as const;
    }, STOPS_TRANSACTION);

    switch (result.kind) {
      case "no-trip":
        return tripNotFound();
      case "no-stop":
        return refusalResponse(NOT_IN_ITINERARY);
      case "refused":
        return refusalResponse(result.failure);
      case "changed":
        return stopsResponse(result.stop, result.stops, 200);
    }
  } catch (error) {
    return stopsFailure(error, "change the stop");
  }
}

/**
 * DELETE /api/trips/[id]/stops/[stopId]
 *
 * Removes a stop from its day (US-E4-01, #60, AC4). Needs a logged-in user (401 without one, 403 for a
 * request from another site) and a trip that is the user's.
 *
 * - 204 when the stop is removed. The stops after it in its day move up by one, so the positions stay
 *   1, 2, 3 and keep their order. The place itself is not touched.
 * - 404 for a trip that does not exist or is not the user's, and for a stop that is not in it.
 *
 * The removal and the new positions are saved in one transaction.
 */
export async function DELETE(request: Request, { params }: Context) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id, stopId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const state = await loadItinerary(tx, id, guard.user.id, {
        lock: true,
      });
      if (state === null) {
        return { kind: "no-trip" } as const;
      }

      const removal = removeStop(state.stops, stopId);
      if (!removal.ok) {
        return { kind: "refused", failure: removal } as const;
      }

      await tx.itineraryStop.delete({ where: { id: stopId } });
      await savePlacements(tx, removal.changes);

      return { kind: "removed" } as const;
    }, STOPS_TRANSACTION);

    switch (result.kind) {
      case "no-trip":
        return tripNotFound();
      case "refused":
        return refusalResponse(result.failure);
      case "removed":
        return new Response(null, { status: 204 });
    }
  } catch (error) {
    return stopsFailure(error, "remove the stop");
  }
}
