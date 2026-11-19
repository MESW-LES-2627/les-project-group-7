import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { refreshPlaceStats } from "@/lib/place-stats";
import { validateReviewUpdateInput } from "@/domain/reviews/review-update-validation";

/**
 * PATCH /api/reviews/[id]
 *
 * Updates a review belonging to the logged-in user.
 * Returns 400 with `error` and, for a wrong field, one message per field in `errors` (as POST does),
 * and 404 when the review does not exist or belongs to another user.
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

    const validation = validateReviewUpdateInput(body);

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error, errors: validation.errors },
        { status: 400 }
      );
    }

    // Find the review only if it belongs to the logged-in user.
    const existingReview = await prisma.review.findFirst({
      where: {
        id,
        userId: guard.user.id,
      },
      select: {
        placeId: true,
      },
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Update only a review owned by the logged-in user.

    const { updatedReview, updatedPlace } = await prisma.$transaction(
      async (tx) => {
        const updatedReview = await tx.review.update({
          where: {
            id,
            userId: guard.user.id,
          },
          data: validation.value,
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });

        const updatedPlace = await refreshPlaceStats(tx, updatedReview.placeId);

        return { updatedReview, updatedPlace };
      }
    );

    return NextResponse.json({
      review: updatedReview,
      place: updatedPlace,
    });
  } catch (error) {
    // The review may have been deleted between lookup and update.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    console.error("PATCH /api/reviews/[id] failed:", error);

    return NextResponse.json(
      { error: "Could not update the review" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reviews/[id]
 *
 * Deletes a review belonging to the logged-in user.
 * Keeps the place marked as visited and refreshes its statistics.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;

    const deleted = await prisma.$transaction(async (tx) => {
      const review = await tx.review.findFirst({
        where: {
          id,
          userId: guard.user.id,
        },
        select: {
          placeId: true,
        },
      });

      if (!review) return false;

      const result = await tx.review.deleteMany({
        where: {
          id,
          userId: guard.user.id,
        },
      });

      if (result.count === 0) return false;

      await refreshPlaceStats(tx, review.placeId);

      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/reviews/[id] failed:", error);

    return NextResponse.json(
      { error: "Could not delete the review" },
      { status: 500 }
    );
  }
}
