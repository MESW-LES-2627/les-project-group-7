/**
 * Who writes the sample reviews of a place (US-B2-01). Pure: the seed does the database work.
 *
 * The rule of US-C1-01: nobody reviews the same place twice. So the reviews of one place go to
 * different users, and users who already have a review there are skipped. When there are not
 * enough users, the seed stops with an error instead of repeating one.
 */

/**
 * Picks `count` different users for the reviews of one place, in the order of `userIds`, starting
 * at `offset` and wrapping around (so that the first user does not write the first review of every
 * place). Users in `alreadyReviewed` are skipped.
 */
export function pickReviewers(
  count: number,
  userIds: readonly string[],
  alreadyReviewed: ReadonlySet<string> = new Set(),
  offset = 0
): string[] {
  const available = [...new Set(userIds)].filter(
    (id) => !alreadyReviewed.has(id)
  );

  if (count > available.length) {
    throw new Error(
      `A place needs ${count} reviewers but only ${available.length} users can still review it: add demo users`
    );
  }

  const start =
    available.length === 0 ? 0 : Math.abs(offset) % available.length;
  const rotated = [...available.slice(start), ...available.slice(0, start)];
  return rotated.slice(0, count);
}
