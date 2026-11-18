import type { Prisma, PrismaClient } from "@prisma/client";
import {
  calculateAverageRating,
  calculatePlacePriceLevel,
} from "@/domain/reviews/rating";

// Supports both the regular Prisma client and a transaction client.
type DatabaseClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "place" | "review" | "visit"
>;

/**
 * Recalculates a place's stored statistics from its reviews.
 * ADR-010: all review writers share this policy.
 */
export async function refreshPlaceStats(db: DatabaseClient, placeId: string) {
  const place = await db.place.findUniqueOrThrow({
    where: { id: placeId },
    select: { priceLevel: true },
  });

  const reviews = await db.review.findMany({
    where: { placeId },
    select: { rating: true, priceLevel: true },
  });

  const averageRating = calculateAverageRating(
    reviews.map((review) => review.rating)
  );

  const priceLevel =
    reviews.length === 0
      ? null
      : calculatePlacePriceLevel(
          place.priceLevel,
          reviews.map((review) => review.priceLevel)
        );

  return db.place.update({
    where: { id: placeId },
    data: {
      averageRating,
      reviewCount: reviews.length,
      priceLevel,
    },
  });
}

/**
 * Marks a place as visited by a user.
 * Does not remove existing visits when reviews are deleted.
 */
export async function markPlaceVisited(
  db: DatabaseClient,
  userId: string,
  placeId: string,
  preserveExisting = false
) {
  return db.visit.upsert({
    where: {
      userId_placeId: { userId, placeId },
    },
    update: preserveExisting ? {} : { visitedAt: new Date() },
    create: {
      userId,
      placeId,
    },
  });
}
