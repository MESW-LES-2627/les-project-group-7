import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { lockItinerary, STOPS_TRANSACTION } from "@/lib/trip-stops";
import {
  formatDateOnly,
  startOfTodayInTimeZone,
} from "@/domain/trips/trip-days";
import { syncDays } from "@/domain/trips/sync-days";
import { validateTripEdit } from "@/domain/trips/trip-edit";
import { toTripResponse } from "@/domain/trips/trip-response";

/**
 * DELETE /api/trips/[id]
 *
 * Deletes a trip of the logged-in user (US-E3-01, #57). Needs a logged-in user (401 without one,
 * 403 for a request from another site).
 *
 * - 204 when the trip is deleted. Its days, its itinerary and the stops go with it (`onDelete:
 *   Cascade` in the schema). Places, reviews and saved places do not belong to a trip, so they stay.
 * - 404 when there is no such trip, or it is another user's: the same answer for both, so the
 *   response does not tell whether the id exists.
 *
 * One `deleteMany` filtered by owner, after the lock of the itinerary: there is no gap between checking
 * the owner and deleting, and an edit of the same trip at the same moment waits.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);

  if (!guard.ok) {
    return guard.response;
  }

  try {
    const { id } = await params;

    // The same lock as the edit of the trip and the changes of its stops: a delete and an edit of the
    // same trip at the same moment wait for each other instead of ending in a deadlock. A trip without
    // an itinerary has nothing to lock, and the delete below still decides if there is such a trip.
    const count = await prisma.$transaction(async (tx) => {
      await lockItinerary(tx, id, guard.user.id);
      const result = await tx.trip.deleteMany({
        where: { id, userId: guard.user.id },
      });
      return result.count;
    }, STOPS_TRANSACTION);

    if (count === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/trips/[id] failed:", error);

    return NextResponse.json(
      { error: "Could not delete the trip" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/trips/[id]
 *
 * Changes the name and the dates of a trip of the logged-in user (US-E2-01, #55). The city stays.
 * Needs a logged-in user (401 without one, 403 for a request from another site).
 *
 * Body: `name`, `startDate` and `endDate` (YYYY-MM-DD), and `confirmedStops`: the number of stops the
 * person was told would be removed, to accept that days with stops go.
 *
 * - 200 with the trip. The days follow the dates (`syncDays`): new empty days at the end when the trip
 *   is longer, the days at the end and their stops removed when it is shorter, and a new date for each
 *   day when the start date moves. The stops stay on their day numbers.
 * - 400 with `errors` (one message for each wrong field) and nothing changed.
 * - 409 with `removal.days` (their numbers, dates and how many stops each has) and nothing changed,
 *   when days with stops would go and `confirmedStops` is not exactly the number of their stops now:
 *   a stop added after the warning was shown is never removed without a new warning. Days without
 *   stops go without asking: nothing is lost.
 * - 404 when there is no such trip, or it is another user's.
 *
 * Everything runs in one transaction that first takes the lock of the itinerary, the same lock as the
 * changes of the stops, so the stops that are counted are the ones that are removed.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const outcome = await prisma.$transaction(
      async (tx) => {
        if (!(await lockItinerary(tx, id, guard.user.id))) {
          return { kind: "notFound" } as const;
        }

        // The trip can be gone by now (deleted while this request waited for the lock): that is a 404
        const trip = await tx.trip.findFirst({
          where: { id, userId: guard.user.id },
          include: {
            city: { select: { timezone: true } },
            days: {
              select: {
                id: true,
                dayNumber: true,
                date: true,
                _count: { select: { stops: true } },
              },
            },
          },
        });

        if (trip === null) {
          return { kind: "notFound" } as const;
        }

        const validation = validateTripEdit(
          body,
          trip,
          startOfTodayInTimeZone(new Date(), trip.city.timezone)
        );
        if (!validation.ok) {
          return { kind: "invalid", errors: validation.errors } as const;
        }

        const { name, startDate, endDate, confirmedStops } = validation.value;
        const sync = syncDays(trip.days, startDate, endDate);
        if (!sync.ok) {
          return { kind: "invalid", errors: { endDate: sync.error } } as const;
        }

        // In day order: the database gives the days in the order they were written, which changes
        // once the dates of a day have been updated
        const withStops = trip.days
          .filter(
            (day) => sync.remove.includes(day.dayNumber) && day._count.stops > 0
          )
          .sort((a, b) => a.dayNumber - b.dayNumber);
        const stopsRemoved = withStops.reduce(
          (total, day) => total + day._count.stops,
          0
        );
        if (stopsRemoved > 0 && confirmedStops !== stopsRemoved) {
          return { kind: "confirm", days: withStops } as const;
        }

        await tx.trip.update({
          where: { id },
          data: { name, startDate, endDate },
        });
        await tx.day.deleteMany({
          where: { tripId: id, dayNumber: { in: sync.remove } },
        });
        for (const day of sync.update) {
          const stored = trip.days.find((d) => d.dayNumber === day.dayNumber);
          await tx.day.update({
            where: { id: stored?.id },
            data: { date: day.date },
          });
        }
        await tx.day.createMany({
          data: sync.add.map((day) => ({ ...day, tripId: id })),
        });

        const saved = await tx.trip.findFirstOrThrow({
          where: { id },
          include: { days: true, itinerary: true },
        });
        return { kind: "saved", saved } as const;
      },
      // The default 5 seconds is short here: the lock is held for about 8 queries and one more for each
      // day whose date changes (14 at most), and the database can be far away.
      { ...STOPS_TRANSACTION, timeout: 15_000 }
    );

    if (outcome.kind === "notFound") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (outcome.kind === "invalid") {
      const [firstError] = Object.values(outcome.errors);
      return NextResponse.json(
        { error: firstError ?? "Invalid trip", errors: outcome.errors },
        { status: 400 }
      );
    }

    if (outcome.kind === "confirm") {
      return NextResponse.json(
        {
          error: "Shortening the trip removes days that have stops",
          removal: {
            days: outcome.days.map((day) => ({
              dayNumber: day.dayNumber,
              date: formatDateOnly(day.date),
              stops: day._count.stops,
            })),
          },
        },
        { status: 409 }
      );
    }

    const { saved } = outcome;
    if (!saved.itinerary) {
      throw new Error("The trip has no itinerary");
    }

    return NextResponse.json(
      toTripResponse({ ...saved, itinerary: saved.itinerary })
    );
  } catch (error) {
    console.error("PATCH /api/trips/[id] failed:", error);

    return NextResponse.json(
      { error: "Could not save the trip" },
      { status: 500 }
    );
  }
}
