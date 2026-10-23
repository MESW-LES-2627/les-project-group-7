import { NextResponse } from "next/server";
import { PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateAverageRating } from "@/domain/reviews/rating";

/**
 * User-Defined Type Guard verifying if an unknown value is a valid Prisma PlaceCategory.
 */
function isPlaceCategory(val: unknown): val is PlaceCategory {
  return typeof val === "string" && val in PlaceCategory;
}

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
 *
 * Reviews & Rating Domain Policy API Handler.
 * Creates a review, updates place average rating, and marks place visited.
 * Automatically enforces Domain Policy:
 * 1. Upserts place dynamically from OpenStreetMap if discovered on-the-fly.
 * 2. Persists the user review with star rating and optional comments.
 * 3. Triggers Visit Policy: Automatically marks the place as visited by the author.
 * 4. Recalculates arithmetic average rating and review counts.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { placeId, rating, text, userId } = body;

    // Step 1: Validate the review input
    if (!placeId || typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        {
          error:
            "Invalid review input. Rating must be an integer between 1 and 5.",
        },
        { status: 400 }
      );
    }

    // Step 2: Pick and provision a demo user for testing
    const targetUserId = userId || "demo-user-1";

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

    // Step 3: On-the-fly ingestion of an OpenStreetMap place (if it is not in the database yet)
    const existingPlace = await prisma.place.findUnique({
      where: { id: placeId },
    });

    if (!existingPlace && body.place) {
      let city = await prisma.city.findFirst({
        where: { name: { contains: "Porto", mode: "insensitive" } },
      });

      if (!city) {
        city = await prisma.city.create({
          data: {
            name: "Porto",
            country: "Portugal",
            latitude: 41.1496,
            longitude: -8.6109,
          },
        });
      }

      const rawCategory = body.place.category;
      const category: PlaceCategory = isPlaceCategory(rawCategory)
        ? rawCategory
        : PlaceCategory.OTHER;

      await prisma.place.create({
        data: {
          id: placeId,
          osmId: placeId.startsWith("osm-")
            ? placeId.replace("osm-", "")
            : body.place.osmId || undefined,
          name:
            typeof body.place.name === "string"
              ? body.place.name
              : "Discovered Place",
          address:
            typeof body.place.address === "string"
              ? body.place.address
              : "Porto",
          category,
          latitude:
            typeof body.place.latitude === "number"
              ? body.place.latitude
              : 41.1496,
          longitude:
            typeof body.place.longitude === "number"
              ? body.place.longitude
              : -8.6109,
          priceLevel:
            typeof body.place.priceLevel === "string"
              ? body.place.priceLevel
              : "€",
          cityId: city.id,
          source: "LAZY_OSM",
        },
      });
    }

    // Step 4: Create the Review record
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

    // Step 5: Domain policy — mark the place as visited for the author
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

    // Step 6: Domain policy — recalculate the arithmetic mean of the ratings
    const allReviews = await prisma.review.findMany({
      where: { placeId },
      select: { rating: true },
    });

    const ratingsList: number[] = [];
    for (let i = 0; i < allReviews.length; i++) {
      ratingsList.push(allReviews[i].rating);
    }
    const newAvg = calculateAverageRating(ratingsList);

    // Step 7: Update the Place with the new average and count
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
