/**
 * Limit on registration attempts per address (pure helpers; the counter itself is stored in the
 * database by src/lib/register-rate-limit.ts). Fixed window: at most REGISTER_MAX_ATTEMPTS calls
 * in REGISTER_WINDOW_MS. A call counts once it passes the input check, also when the name then
 * turns out to be taken, so the endpoint cannot be used to probe for taken usernames and e-mails
 * (or to burn CPU on password hashes) without limit. Typos in the form are free.
 */

export const REGISTER_WINDOW_MS = 10 * 60 * 1000;
export const REGISTER_MAX_ATTEMPTS = 20;

const MAX_ADDRESS_LENGTH = 64;

/**
 * The address of the caller. Behind Vercel the first x-forwarded-for entry is the real client:
 * Vercel overwrites the header, so a caller cannot choose it there.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, MAX_ADDRESS_LENGTH);
}

export function rateLimitDecision(
  count: number,
  windowStart: number,
  now: number
): { allowed: boolean; retryAfterSeconds: number } {
  const msLeft = windowStart + REGISTER_WINDOW_MS - now;
  return {
    allowed: count <= REGISTER_MAX_ATTEMPTS,
    retryAfterSeconds: Math.max(1, Math.ceil(msLeft / 1000)),
  };
}
