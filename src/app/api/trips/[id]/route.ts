import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

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
 * One `deleteMany` filtered by owner: there is no gap between checking the owner and deleting.
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

    const { count } = await prisma.trip.deleteMany({
      where: { id, userId: guard.user.id },
    });

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
