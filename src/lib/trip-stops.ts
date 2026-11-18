import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type {
  StopPlacement,
  StopRefusal,
  StopRuleFailure,
  TripLayout,
} from "@/domain/itinerary/stop-order";
import {
  toStopResponse,
  type StopRecord,
} from "@/domain/itinerary/stop-response";

/**
 * What the three Stops API routes share (US-E4-01, #60): loading the itinerary of a trip of the
 * logged-in user, saving the new positions, listing the stops, and turning a refusal or a failure into
 * an answer.
 */

export type StopsTransaction = Prisma.TransactionClient;

/** Every change of an itinerary reads and writes the positions of a day, so they run one at a time. */
export const STOPS_TRANSACTION = { isolationLevel: "Serializable" } as const;

export interface ItineraryState {
  itineraryId: string;
  layout: TripLayout;
  stops: StopRecord[];
}

/** What is read of a stop: where it is, its time and the place as a day of the itinerary shows it. */
export const STOP_SELECT = {
  id: true,
  dayId: true,
  placeId: true,
  position: true,
  visitTime: true,
  place: {
    select: {
      id: true,
      name: true,
      category: true,
      address: true,
      latitude: true,
      longitude: true,
      priceLevel: true,
    },
  },
} as const;

/**
 * The stops of an itinerary in the order of the trip: by day, then by position.
 */
export async function listStops(
  tx: StopsTransaction,
  itineraryId: string
): Promise<StopRecord[]> {
  return tx.itineraryStop.findMany({
    where: { itineraryId },
    select: STOP_SELECT,
    orderBy: [{ day: { dayNumber: "asc" } }, { position: "asc" }],
  });
}

/**
 * The itinerary of a trip, if the trip belongs to the user. The owner is in the filter, so another
 * user's trip is the same as a trip that does not exist. Returns `null` for both.
 */
export async function loadItinerary(
  tx: StopsTransaction,
  tripId: string,
  userId: string
): Promise<ItineraryState | null> {
  const trip = await tx.trip.findFirst({
    where: { id: tripId, userId },
    select: {
      cityId: true,
      days: { select: { id: true } },
      itinerary: { select: { id: true } },
    },
  });

  if (!trip?.itinerary) {
    return null;
  }

  return {
    itineraryId: trip.itinerary.id,
    layout: { cityId: trip.cityId, dayIds: trip.days.map((day) => day.id) },
    stops: await listStops(tx, trip.itinerary.id),
  };
}

/** Saves the new day and position of the stops that the rules say have to change. */
export async function savePlacements(
  tx: StopsTransaction,
  changes: readonly StopPlacement[]
): Promise<void> {
  for (const change of changes) {
    await tx.itineraryStop.update({
      where: { id: change.id },
      data: { dayId: change.dayId, position: change.position },
    });
  }
}

/** The body of a request as an object, or `null` when it is not JSON or not an object. */
export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const REFUSAL_STATUS: Record<StopRefusal, number> = {
  STOP_NOT_FOUND: 404,
  UNKNOWN_DAY: 400,
  INVALID_POSITION: 400,
  OTHER_CITY: 400,
  ALREADY_PLANNED: 409,
};

/** The answer for a change that the rules refuse. Nothing was saved. */
export function refusalResponse(failure: StopRuleFailure): Response {
  return NextResponse.json(
    { error: failure.error, reason: failure.reason },
    { status: REFUSAL_STATUS[failure.reason] }
  );
}

/** The stops of a trip, in order, for a read that changes nothing. */
export function stopsListResponse(stops: readonly StopRecord[]): Response {
  return NextResponse.json({ stops: stops.map(toStopResponse) });
}

export function tripNotFound(): Response {
  return NextResponse.json({ error: "Trip not found" }, { status: 404 });
}

export function stopsResponse(
  stop: StopRecord,
  stops: readonly StopRecord[],
  status: number
): Response {
  return NextResponse.json(
    { stop: toStopResponse(stop), stops: stops.map(toStopResponse) },
    { status }
  );
}

/**
 * The answer for an error that was not expected. Two changes at the same time can make the database
 * refuse one of them (P2034, or P2002 when both save the same new place): nothing was saved and the
 * person can try again.
 */
export function stopsFailure(error: unknown, what: string): Response {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "P2034" || code === "P2002") {
    return NextResponse.json(
      {
        error:
          "The itinerary was changed at the same time. Nothing was saved, try again",
      },
      { status: 409 }
    );
  }

  console.error(`${what} failed:`, error);

  return NextResponse.json({ error: `Could not ${what}` }, { status: 500 });
}
