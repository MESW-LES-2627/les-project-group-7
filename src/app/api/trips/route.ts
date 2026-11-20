import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import {
  buildTripDays,
  startOfTodayInTimeZone,
} from "@/domain/trips/trip-days";
import {
  toTripResponse,
  toTripSummaryResponse,
} from "@/domain/trips/trip-response";
import { validateTripInput } from "@/domain/trips/trip-validation";

/**
 * POST /api/trips
 *
 * Creates a trip (US-E1-01, #7). Needs a logged-in user (401 without one, 403 for a request from
 * another site): the owner is the user of the session, never a `userId` from the body.
 *
 * Body: `name`, `cityId`, and `startDate` and `endDate` (YYYY-MM-DD). Nothing else: the budget level
 * and the hour limits are optional settings of the itinerary, and the types of place are an input of
 * the generator.
 *
 * The dates are local to the city of the trip, whatever the time zone of the person: "the start date
 * is today or later" means today in the city (`City.timezone`).
 *
 * - 400 with `errors` (one message for each wrong field) and nothing saved if the form is wrong.
 * - 201 with the trip, its days and its itinerary when it is saved: one day for each date, from the
 *   start date to the end date, and an empty itinerary (no stops, no settings), all created together
 *   with the trip in one write.
 */
export async function POST(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // The city comes first: "today" is today in that city.
    const cityId =
      typeof body === "object" &&
      body !== null &&
      "cityId" in body &&
      typeof body.cityId === "string"
        ? body.cityId.trim()
        : "";
    const city = cityId
      ? await prisma.city.findUnique({
          where: { id: cityId },
          select: { id: true, timezone: true },
        })
      : null;

    const validation = validateTripInput(
      body,
      startOfTodayInTimeZone(new Date(), city?.timezone ?? "UTC")
    );
    const errors = validation.ok ? {} : { ...validation.errors };
    if (cityId && !city) {
      errors.cityId = "This city does not exist";
    }

    if (!validation.ok || city === null) {
      const [firstError] = Object.values(errors);
      return NextResponse.json(
        { error: firstError ?? "Invalid trip", errors },
        { status: 400 }
      );
    }

    const trip = validation.value;

    const created = await prisma.trip.create({
      data: {
        name: trip.name,
        cityId: trip.cityId,
        userId: guard.user.id,
        startDate: trip.startDate,
        endDate: trip.endDate,
        days: { create: buildTripDays(trip.startDate, trip.endDate) },
        itinerary: { create: { mode: "MANUAL" } },
      },
      include: { days: true, itinerary: true },
    });

    if (!created.itinerary) {
      throw new Error("The trip was created without its itinerary");
    }

    return NextResponse.json(
      toTripResponse({ ...created, itinerary: created.itinerary }),
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create trip:", error);

    return NextResponse.json(
      { error: "Failed to create the trip" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trips
 *
 * Lists all trips belonging to the logged-in user (US-E1-01, #9).
 * Needs a logged-in user (401 without one).
 *
 * Returns 200 with the list of trips ordered by start date (descending).
 * Trips of other users are never returned.
 */
export async function GET(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const trips = await prisma.trip.findMany({
      where: { userId: guard.user.id },
      include: {
        city: { select: { id: true, name: true, country: true } },
        days: { select: { id: true } },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(trips.map(toTripSummaryResponse));
  } catch (error) {
    console.error("GET /api/trips failed:", error);
    return NextResponse.json(
      { error: "Failed to list trips" },
      { status: 500 }
    );
  }
}
