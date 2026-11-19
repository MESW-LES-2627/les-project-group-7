import type { Prisma, PrismaClient } from "@prisma/client";
import {
  calculateAverageRating,
  calculatePlacePriceLevel,
} from "@/domain/reviews/rating";

// Supports both the regular Prisma client and a transaction client.
type DatabaseClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "place" | "review" | "visit" | "$queryRaw"
>;

/**
 * Recalculates a place's stored statistics from its reviews.
 * ADR-010: all review writers share this policy.
 *
 * Call it inside the transaction that changes the review. It first locks the row of the place until
 * the transaction ends, so two changes to the reviews of one place run one after the other: the
 * second waits, then reads the reviews that the first one saved. Without the lock both read the list
 * as it was before the other change, and the last one to finish stores a rating that is wrong until
 * the next change. (Outside a transaction the lock ends at once and changes nothing.)
 *
 * The lock is `FOR NO KEY UPDATE`, not `FOR UPDATE`: saving a review or a visit takes a shared lock
 * on the place for its foreign key, and `FOR UPDATE` conflicts with it, so two parallel posts waited
 * for each other (deadlock, tested against a database). `FOR NO KEY UPDATE` only conflicts with
 * itself and with the update of the place, which is what is needed.
 */
export async function refreshPlaceStats(db: DatabaseClient, placeId: string) {
  await db.$queryRaw`SELECT "id" FROM "Place" WHERE "id" = ${placeId} FOR NO KEY UPDATE`;

  const place = await db.place.findUniqueOrThrow({
    where: { id: placeId },
    select: { osmPriceLevel: true },
  });

  const reviews = await db.review.findMany({
    where: { placeId },
    select: { rating: true, priceLevel: true },
  });

  const averageRating = calculateAverageRating(
    reviews.map((review) => review.rating)
  );

  // The starting point is what OpenStreetMap says (FREE or nothing), not the price level stored now:
  // the stored one already holds the effect of the reviews, so a review that is edited or deleted could
  // never take it back. With no review that gives a price, the place has what OpenStreetMap says.
  const priceLevel = calculatePlacePriceLevel(
    place.osmPriceLevel,
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
