/**
 * The rule "a user reviews a place only once" (US-C1-01, #37). The database enforces it with a unique
 * index on the user and the place; these pure functions let the endpoint and the form answer clearly.
 */

export const ALREADY_REVIEWED_MESSAGE =
  "You already reviewed this place. Edit your review instead.";

/**
 * Whether an error of the database client is the refusal of a second review of the same user on the
 * same place (Prisma code P2002 on the index of the user and the place). It happens when two requests
 * of one user arrive together, because both pass the check before either is saved.
 */
export function isRepeatedReviewError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, meta } = error as {
    code?: unknown;
    meta?: { target?: unknown };
  };
  if (code !== "P2002") return false;

  // Prisma names the columns (a list) or the index (a text): as text, both hold the two column names
  const target = String(meta?.target);
  return target.includes("userId") && target.includes("placeId");
}

/**
 * Whether the reviews of a place include one by this user. Usernames are compared without case: the
 * name shown for the session is the one the user typed and the one of a review is stored in lower case.
 */
export function hasReviewedPlace(
  reviews: readonly { user?: { username?: string | null } | null }[],
  username: string | null | undefined
): boolean {
  if (!username) return false;
  const wanted = username.toLowerCase();
  return reviews.some(
    (review) => review.user?.username?.toLowerCase() === wanted
  );
}
