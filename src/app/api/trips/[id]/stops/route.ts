import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { placeNewStop } from "@/domain/itinerary/stop-order";
import { parseVisitTime } from "@/domain/itinerary/visit-time";
import { areaOfCity } from "@/domain/osm/city-areas";
import {
  parseDiscoveredPlace,
  type DiscoveredPlace,
} from "@/domain/osm/discovered-place";
import { osmIdFromDiscoveredPlaceId, osmPriceLevelOf } from "@/domain/osm/osm";
import {
  loadItinerary,
  listStops,
  readJsonObject,
  refusalResponse,
  savePlacements,
  stopsFailure,
  stopsListResponse,
  stopsResponse,
  STOP_SELECT,
  STOPS_TRANSACTION,
  tripNotFound,
} from "@/lib/trip-stops";

/**
 * GET /api/trips/[id]/stops
 *
 * The stops of a trip in order, by day and then by position, each with its place (name, category,
 * address, position on the map and price level), so a page needs no other request to draw the days
 * (US-E4-01, #60). Needs a logged-in user (401 without one) and a trip that is the user's.
 *
 * - 200 with `stops`: empty for a trip without stops.
 * - 404 when there is no such trip, or it is another user's: the same answer for both.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;

    const state = await loadItinerary(prisma, id, guard.user.id);
    if (state === null) {
      return tripNotFound();
    }

    return stopsListResponse(state.stops);
  } catch (error) {
    return stopsFailure(error, "list the stops");
  }
}

/**
 * POST /api/trips/[id]/stops
 *
 * Adds a place to a day of a trip (US-E4-01, #60): as the last stop of the day, or, if it has a visit time,
 * among the stops that have a time, after the last one with the same or an earlier time (so the stops
 * with a time stay in the order of their times; the stops without a time stay where they are, and
 * the stops after the new one move down). Needs a logged-in user
 * (401 without one, 403 for a request from another site) and a trip that is the user's.
 *
 * Body: `dayId`, `placeId` and, if wanted, `visitTime` ("HH:mm").
 *
 * Any place of the map can be added. A place of the catalog is found by its id. A place that the map
 * or the search found in OpenStreetMap and that is not in the catalog yet (its id is like
 * `osm-node-123`) is added by sending its data in `place` (`name`, `latitude`, `longitude` and, if
 * known, `address`, `category` and `priceLevel`): it is saved in the catalog, in the city of the trip,
 * together with the stop, unless the catalog already has a place with the same OpenStreetMap id (then
 * that one is used, so there are no two copies). Its position has to be inside the area of the trip's
 * city, otherwise it is refused.
 *
 * - 201 with the new `stop` and the `stops` of the trip in order (by day, then by position).
 * - 400 with `errors` for a missing or wrong field, or `reason` when the rules refuse: the day is not
 *   a day of the trip (`UNKNOWN_DAY`), or the place is in another city or outside the area of the
 *   trip's city (`OTHER_CITY`, AC6).
 * - 404 when there is no such trip, or it is another user's: the same answer for both.
 * - 409 when the place is already in the trip (`ALREADY_PLANNED`, AC5), on any day.
 *
 * The visit time is any time of the day. The hour limits of the itinerary are never read: they only
 * warn, they never block (AC7, AC8). The place and the stop are saved in one transaction.
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

      // The place of the catalog, by its id or, for a place of the map, by its OpenStreetMap id.
      let place = await tx.place.findUnique({
        where: { id: placeId },
        select: { id: true, cityId: true },
      });

      if (place === null) {
        const osmId = osmIdFromDiscoveredPlaceId(placeId);
        if (osmId !== null) {
          place = await tx.place.findUnique({
            where: { osmId },
            select: { id: true, cityId: true },
          });
        }
      }

      // A place of the map that the catalog does not have yet: its data is checked, and the place is
      // saved in the trip's city only after the stop itself is accepted, so a refusal saves nothing.
      let discovered: DiscoveredPlace | null = null;
      if (place === null) {
        const parsed = parseDiscoveredPlace(
          placeId,
          body.place,
          areaOfCity(state.layout.cityId)
        );

        if (!parsed.ok) {
          return { kind: "no-place", failure: parsed } as const;
        }

        discovered = parsed.value;
      }

      const placed = placeNewStop(
        state.stops,
        state.layout,
        place ?? { id: placeId, cityId: state.layout.cityId },
        dayId,
        visitTime.value
      );
      if (!placed.ok) {
        return { kind: "refused", failure: placed } as const;
      }

      if (discovered !== null) {
        place = await tx.place.create({
          data: {
            ...discovered,
            // What OpenStreetMap says about the price (FREE or nothing): reviews never change it
            osmPriceLevel: osmPriceLevelOf(discovered.priceLevel),
            cityId: state.layout.cityId,
            source: "LAZY_OSM",
          },
          select: { id: true, cityId: true },
        });
      }

      await savePlacements(tx, placed.changes);

      const stop = await tx.itineraryStop.create({
        data: {
          itineraryId: state.itineraryId,
          dayId,
          placeId: place?.id ?? placeId,
          position: placed.position,
          visitTime: visitTime.value,
        },
        select: STOP_SELECT,
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
      case "no-place": {
        const { reason, error } = result.failure;
        if (reason === "OTHER_CITY") {
          return NextResponse.json({ error, reason }, { status: 400 });
        }
        return NextResponse.json(
          { error, errors: { placeId: error } },
          { status: 400 }
        );
      }
      case "refused":
        return refusalResponse(result.failure);
      case "added":
        return stopsResponse(result.stop, result.stops, 201);
    }
  } catch (error) {
    return stopsFailure(error, "add the stop");
  }
}
