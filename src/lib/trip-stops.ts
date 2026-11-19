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

/**
 * Every change of an itinerary reads the positions of the stops and writes new ones, so two changes at
 * the same moment must run one after the other. `loadItinerary(..., { lock: true })` does that: it
 * locks the itinerary until the transaction ends, so the second change waits and then reads what the
 * first one saved. The transaction is read committed, so it reads after the wait. (It was serializable
 * first: the database then refused one of two overlapping changes, or ended them in a deadlock when
 * they updated the same stops in a different order, which was tested against a database.)
 */
export const STOPS_TRANSACTION = { isolationLevel: "ReadCommitted" } as const;

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
 * Locks the itinerary of a trip of the user until the end of the transaction, and reads nothing else.
 * Returns false when there is no such trip, or it is not the user's.
 *
 * NO KEY UPDATE, not UPDATE: saving a stop takes a shared lock on the itinerary for its foreign key,
 * and UPDATE conflicts with it (a deadlock between two parallel adds).
 */
export async function lockItinerary(
  tx: StopsTransaction,
  tripId: string,
  userId: string
): Promise<boolean> {
  const found = await tx.trip.findFirst({
    where: { id: tripId, userId },
    select: { itinerary: { select: { id: true } } },
  });
  if (!found?.itinerary) {
    return false;
  }

  await tx.$queryRaw`SELECT "id" FROM "Itinerary" WHERE "id" = ${found.itinerary.id} FOR NO KEY UPDATE`;
  return true;
}

/**
 * The itinerary of a trip, if the trip belongs to the user. The owner is in the filter, so another
 * user's trip is the same as a trip that does not exist. Returns `null` for both.
 *
 * @param options.lock lock the itinerary until the end of the transaction before anything else is
 * read: every writer of the stops asks for it, a reader does not. Whatever else changes the days or
 * the stops of a trip (the edit of the dates, #55) has to take the same lock.
 */
export async function loadItinerary(
  tx: StopsTransaction,
  tripId: string,
  userId: string,
  options: { lock?: boolean } = {}
): Promise<ItineraryState | null> {
  if (options.lock && !(await lockItinerary(tx, tripId, userId))) {
    return null;
  }

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
  TIME_ORDER: 400,
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
 * The answer for an error that was not expected. The changes of an itinerary wait for each other, so
 * this should be rare, but if the database still refuses one (a write conflict, a deadlock, or a
 * second save of the same new place) nothing was saved and the person can try again.
 */
export function stopsFailure(error: unknown, what: string): Response {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  if (
    code === "P2034" ||
    code === "P2002" ||
    /40P01|40001|deadlock detected|could not serialize/i.test(message)
  ) {
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
