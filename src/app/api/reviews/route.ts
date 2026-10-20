import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAverageRating } from "@/domain/rating";

// Known dummy users for automatic fallback provisioning if DB is empty
const DUMMY_USERS: Record<string, { username: string; email: string }> = {
  "demo-user-1": { username: "viajante_porto", email: "demo@tripbook.pt" },
  "demo-user-2": { username: "ana_exploradora", email: "ana@tripbook.pt" },
};

/**
 * GET /api/reviews?placeId={id}
 * Retrieves reviews history for a place, sorted with newest first.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");

    if (!placeId) {
      return NextResponse.json(
        { error: "placeId query parameter is required" },
        { status: 400 }
      );
    }

    const reviews = await prisma.review.findMany({
      where: { placeId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Failed to fetch reviews:", error);

    return NextResponse.json(
      { error: "Failed to fetch reviews from database" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews
 * Creates a review, updates place average rating, and marks place visited.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { placeId, rating, text, userId } = body;

    // Validate review input
    if (!placeId || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Invalid review input. Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    // Default to primary demo user if none supplied
    const targetUserId = userId || "demo-user-1";

    // Ensure dummy user exists in DB to prevent foreign key errors during isolated tests
    if (DUMMY_USERS[targetUserId]) {
      await prisma.user.upsert({
        where: { id: targetUserId },
        update: {},
        create: {
          id: targetUserId,
          username: DUMMY_USERS[targetUserId].username,
          email: DUMMY_USERS[targetUserId].email,
          passwordHash: "hash_demo_12345",
          role: "USER",
        },
      });
    }

    // 1. Create the Review record
    const newReview = await prisma.review.create({
      data: {
        userId: targetUserId,
        placeId,
        rating: Math.round(rating),
        text: text || "",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // 2. Trigger Domain Policy: Mark place visited for this user
    await prisma.visit.upsert({
      where: {
        userId_placeId: {
          userId: targetUserId,
          placeId,
        },
      },
      update: {
        visitedAt: new Date(),
      },
      create: {
        userId: targetUserId,
        placeId,
      },
    });

    // 3. Recalculate average rating for the place
    const allReviews = await prisma.review.findMany({
      where: { placeId },
      select: { rating: true },
    });

    const ratingsList = allReviews.map((r) => r.rating);
    const newAvg = calculateAverageRating(ratingsList);

    // 4. Update the Place record with the new average rating and review count
    const updatedPlace = await prisma.place.update({
      where: { id: placeId },
      data: {
        averageRating: newAvg,
        reviewCount: allReviews.length,
      },
    });

    return NextResponse.json(
      { review: newReview, place: updatedPlace },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to post review:", error);

    return NextResponse.json(
      { error: "Internal server error posting review" },
      { status: 500 }
    );
  }
}
