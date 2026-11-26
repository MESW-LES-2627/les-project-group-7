import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { validateItinerarySettings } from "@/domain/itinerary/itinerary-settings";
import {
  lockItinerary,
  readJsonObject,
  stopsFailure,
  STOPS_TRANSACTION,
  tripNotFound,
} from "@/lib/trip-stops";

/**
 * The settings of the itinerary of a trip (US-E4-01, #144): the budget level and the hour limits.
 *
 * - `GET  /api/trips/[id]/itinerary` → 200 `{ budgetLevel, dayStart, dayEnd }`
 * - `PUT  /api/trips/[id]/itinerary` → 200 with the saved settings
 *
 * PUT replaces the three settings together: the body has all three, and `null` (or `""`) leaves one
 * empty. A wrong setting answers 400 with one message for each wrong setting and nothing is saved.
 * Only the owner of the trip: 401 without a login, 404 for a trip that does not exist or is not
 * theirs. The write takes the lock of the itinerary first, like every other writer of an itinerary.
 */

const SETTINGS_SELECT = {
  budgetLevel: true,
  dayStart: true,
  dayEnd: true,
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;

    const settings = await prisma.itinerary.findFirst({
      where: { trip: { id, userId: guard.user.id } },
      select: SETTINGS_SELECT,
    });

    return settings === null ? tripNotFound() : NextResponse.json(settings);
  } catch (error) {
    return stopsFailure(error, "read the settings of the itinerary");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonObject(request);
  if (body === null) {
    return NextResponse.json(
      { error: "Send the settings as a JSON object" },
      { status: 400 }
    );
  }

  const validation = validateItinerarySettings(body);
  if (!validation.ok) {
    const [firstError] = Object.values(validation.errors);
    return NextResponse.json(
      { error: firstError, errors: validation.errors },
      { status: 400 }
    );
  }

  try {
    const { id } = await params;

    const saved = await prisma.$transaction(async (tx) => {
      if (!(await lockItinerary(tx, id, guard.user.id))) {
        return null;
      }

      return tx.itinerary.update({
        where: { tripId: id },
        data: validation.value,
        select: SETTINGS_SELECT,
      });
    }, STOPS_TRANSACTION);

    return saved === null ? tripNotFound() : NextResponse.json(saved);
  } catch (error) {
    return stopsFailure(error, "save the settings of the itinerary");
  }
}
