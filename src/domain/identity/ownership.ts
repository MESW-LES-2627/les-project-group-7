/**
 * Ownership rule (US-A1-02, acceptance criterion 5): a logged-in user can change only what they
 * own. The ids are compared exactly. Nobody logged in, or an unknown owner, never matches.
 *
 * The endpoints that edit or delete a review, a list or a trip (C2, D2, E2, E3) call this with the
 * id of the session user and the owner of the row.
 */
export function canModify(
  sessionUserId: string | null | undefined,
  ownerId: string
): boolean {
  return Boolean(sessionUserId) && ownerId !== "" && sessionUserId === ownerId;
}
