import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

/**
 * GET /api/visits
 *
 * Returns the authenticated user's visited places,
 * ordered from the most recent visit to the oldest.
 *
 * Includes the user's own rating when a review exists.
 * A visit remains visible even if its review was deleted.
 */
export async function GET(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const userId = guard.user.id;

    const visits = await prisma.visit.findMany({
      where: { userId },
      select: {
        visitedAt: true,
        place: {
          select: {
            id: true,
            name: true,
            category: true,
            address: true,
            city: {
              select: {
                name: true,
                country: true,
              },
            },
            reviews: {
              where: { userId },
              select: {
                rating: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ visitedAt: "desc" }, { placeId: "asc" }],
    });

    const result = visits.map((visit) => ({
      placeId: visit.place.id,
      name: visit.place.name,
      category: visit.place.category,
      address: visit.place.address,
      city: visit.place.city,
      visitedAt: visit.visitedAt,
      rating: visit.place.reviews[0]?.rating ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch visited places:", error);

    return NextResponse.json(
      { error: "Failed to fetch visited places" },
      { status: 500 }
    );
  }
}
