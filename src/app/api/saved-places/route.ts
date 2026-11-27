import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { validateSavedPlaceInput } from "@/domain/saved-places/saved-place-validation";

/**
 * POST /api/saved-places
 *
 * Saves a place to the authenticated user's Wishlist or Bookmarks.
 * A place can belong to both lists independently.
 */
export async function POST(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateSavedPlaceInput(body);

    if (!validation.ok) {
      const firstError =
        Object.values(validation.errors)[0] ?? "Invalid saved place input";

      return NextResponse.json(
        {
          error: firstError,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const { placeId, type } = validation.value;
    const userId = guard.user.id;

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const existing = await prisma.savedPlace.findUnique({
      where: {
        userId_placeId_type: {
          userId,
          placeId,
          type,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Place already saved in this list" },
        { status: 409 }
      );
    }

    const savedPlace = await prisma.savedPlace.create({
      data: {
        userId,
        placeId,
        type,
      },
    });

    return NextResponse.json(savedPlace, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Place already saved in this list" },
        { status: 409 }
      );
    }

    console.error("Failed to save place:", error);

    return NextResponse.json(
      { error: "Failed to save place" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved-places
 *
 * Removes a place from the authenticated user's Wishlist or Bookmarks.
 * Removing a bookmark also removes the place from the user's custom lists.
 * Wishlist entries remain unaffected.
 */
export async function DELETE(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateSavedPlaceInput(body);

    if (!validation.ok) {
      const firstError =
        Object.values(validation.errors)[0] ?? "Invalid saved place input";

      return NextResponse.json(
        {
          error: firstError,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const { placeId, type } = validation.value;
    const userId = guard.user.id;

    const where = {
      userId,
      placeId,
      type,
    };

    const result =
      type === "BOOKMARK"
        ? await prisma.$transaction(async (tx) => {
            const deleted = await tx.savedPlace.deleteMany({ where });

            if (deleted.count > 0) {
              await tx.listEntry.deleteMany({
                where: {
                  placeId,
                  list: {
                    userId,
                  },
                },
              });
            }

            return deleted;
          })
        : await prisma.savedPlace.deleteMany({ where });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Saved place not found" },
        { status: 404 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove saved place:", error);

    return NextResponse.json(
      { error: "Failed to remove saved place" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/saved-places
 *
 * Returns the authenticated user's saved places, newest first.
 * Optionally filters by WISHLIST or BOOKMARK.
 */
export async function GET(request: Request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type !== null && type !== "WISHLIST" && type !== "BOOKMARK") {
      return NextResponse.json(
        { error: "type must be WISHLIST or BOOKMARK" },
        { status: 400 }
      );
    }

    const savedPlaces = await prisma.savedPlace.findMany({
      where: {
        userId: guard.user.id,
        ...(type !== null ? { type } : {}),
      },
      select: {
        id: true,
        type: true,
        savedAt: true,
        place: {
          select: {
            id: true,
            name: true,
            category: true,
            address: true,
            latitude: true,
            longitude: true,
            priceLevel: true,
            averageRating: true,
            reviewCount: true,
            // The Saved page shows the city and filters by it (#187)
            city: { select: { id: true, name: true, country: true } },
          },
        },
      },
      orderBy: { savedAt: "desc" },
    });

    return NextResponse.json(savedPlaces);
  } catch (error) {
    console.error("Failed to fetch saved places:", error);

    return NextResponse.json(
      { error: "Failed to fetch saved places" },
      { status: 500 }
    );
  }
}
