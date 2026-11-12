import { NextResponse } from "next/server";
import { PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import {
  calculateAverageRating,
  calculatePlacePriceLevel,
  isPriceLevel,
} from "@/domain/reviews/rating";
import { validateReviewInput } from "@/domain/reviews/review-validation";
import {
  ALREADY_REVIEWED_MESSAGE,
  isRepeatedReviewError,
} from "@/domain/reviews/one-review-rule";
import { osmIdFromDiscoveredPlaceId } from "@/domain/osm/osm";

/**
 * User-Defined Type Guard verifying if an unknown value is a valid Prisma PlaceCategory.
 */
function isPlaceCategory(val: unknown): val is PlaceCategory {
  return typeof val === "string" && val in PlaceCategory;
}

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
 * Needs a logged-in user (401 without one, 403 for a request from another site): the author is
 * the user of the session, never a `userId` from the body.
 * Creates a review, updates place average rating, and marks place visited.
 * Automatically enforces Domain Policy:
 * 1. Upserts place dynamically from OpenStreetMap if discovered on-the-fly.
 * 2. Persists the user review with star rating and optional comments (409 if the user already
 *    reviewed the place: one review per user and place).
 * 3. Triggers Visit Policy: Automatically marks the place as visited by the author.
 * 4. Recalculates arithmetic average rating and review counts.
 */
export async function POST(request: Request) {
  // Step 0: Only a logged-in user, from this site's own pages, may write.
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;
  const authorId = guard.user.id;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Step 1: Validate the review input (US-C1-01, #38)
    const validation = validateReviewInput(body);
    if (!validation.ok) {
      const firstError =
        validation.errors.rating ||
        validation.errors.text ||
        validation.errors.priceLevel ||
        validation.errors.placeId ||
        "Invalid review input";
      return NextResponse.json(
        {
          error: firstError,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const { placeId, rating, text, priceLevel } = validation.value;

    // Step 2: On-the-fly ingestion of an OpenStreetMap place (if it is not in the database yet)
    let targetPlaceId: string = placeId;
    let existingPlace = await prisma.place.findUnique({
      where: { id: placeId },
    });

    // A place found by the search or on the map can already be in the catalog, imported with the
    // same OpenStreetMap id: the review goes to that place, not to a second copy of it
    if (!existingPlace && typeof placeId === "string") {
      const osmId = osmIdFromDiscoveredPlaceId(placeId);
      const sameOsmPlace = osmId
        ? await prisma.place.findUnique({ where: { osmId } })
        : null;
      if (sameOsmPlace) {
        existingPlace = sameOsmPlace;
        targetPlaceId = sameOsmPlace.id;
      }
    }

    const rawPlace =
      typeof body === "object" && body !== null && "place" in body
        ? (body as { place?: Record<string, unknown> }).place
        : undefined;

    if (!existingPlace && rawPlace) {
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
            timezone: "Europe/Lisbon",
          },
        });
      }

      const rawCategory = rawPlace.category;
      const category: PlaceCategory = isPlaceCategory(rawCategory)
        ? rawCategory
        : PlaceCategory.OTHER;

      existingPlace = await prisma.place.create({
        data: {
          id: placeId,
          osmId: osmIdFromDiscoveredPlaceId(placeId) ?? undefined,
          name:
            typeof rawPlace.name === "string"
              ? rawPlace.name
              : "Discovered Place",
          address:
            typeof rawPlace.address === "string" ? rawPlace.address : "Porto",
          category,
          latitude:
            typeof rawPlace.latitude === "number" ? rawPlace.latitude : 41.1496,
          longitude:
            typeof rawPlace.longitude === "number"
              ? rawPlace.longitude
              : -8.6109,
          priceLevel: isPriceLevel(rawPlace.priceLevel)
            ? rawPlace.priceLevel
            : null,
          cityId: city.id,
          source: "LAZY_OSM",
        },
      });
    }

    if (!existingPlace) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // A user reviews a place only once (US-C1-01): the unique index of the database is the guarantee,
    // this check gives the clear answer first
    const alreadyReviewed = await prisma.review.findUnique({
      where: { userId_placeId: { userId: authorId, placeId: targetPlaceId } },
      select: { id: true },
    });
    if (alreadyReviewed) {
      return NextResponse.json(
        { error: ALREADY_REVIEWED_MESSAGE },
        { status: 409 }
      );
    }

    // Step 3: Create the Review record
    const newReview = await prisma.review.create({
      data: {
        userId: authorId,
        placeId: targetPlaceId,
        rating,
        text,
        priceLevel,
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

    // Step 4: Domain policy — mark the place as visited for the author
    await prisma.visit.upsert({
      where: {
        userId_placeId: {
          userId: authorId,
          placeId: targetPlaceId,
        },
      },
      update: {
        visitedAt: new Date(),
      },
      create: {
        userId: authorId,
        placeId: targetPlaceId,
      },
    });

    // Step 5: Domain policy — recalculate arithmetic average rating and modal price level
    const allReviews = await prisma.review.findMany({
      where: { placeId: targetPlaceId },
      select: { rating: true, priceLevel: true },
    });

    const ratingsList: number[] = [];
    const priceLevelsList: (string | null)[] = [];
    for (let i = 0; i < allReviews.length; i++) {
      ratingsList.push(allReviews[i].rating);
      priceLevelsList.push(allReviews[i].priceLevel);
    }
    const newAvg = calculateAverageRating(ratingsList);
    const newPriceLevel = calculatePlacePriceLevel(
      existingPlace.priceLevel,
      priceLevelsList
    );

    // Step 6: Update the Place with the new average, count, and price level
    const updatedPlace = await prisma.place.update({
      where: { id: targetPlaceId },
      data: {
        averageRating: newAvg,
        reviewCount: allReviews.length,
        priceLevel: newPriceLevel,
      },
    });

    return NextResponse.json(
      { review: newReview, place: updatedPlace },
      { status: 201 }
    );
  } catch (error) {
    // Two requests of the same user at once both pass the check above: the index refuses the second
    if (isRepeatedReviewError(error)) {
      return NextResponse.json(
        { error: ALREADY_REVIEWED_MESSAGE },
        { status: 409 }
      );
    }
    console.error("Failed to post review:", error);

    return NextResponse.json(
      { error: "Internal server error posting review" },
      { status: 500 }
    );
  }
}
