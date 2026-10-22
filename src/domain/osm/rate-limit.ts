/**
 * Minimum-interval limiter: lets one call through every `intervalMs` and refuses
 * the calls in between. The clock is a parameter so tests do not have to wait.
 *
 * The state lives in the memory of the server instance that created it.
 */
export function createMinIntervalLimiter(
  intervalMs: number,
  now: () => number = Date.now
): () => boolean {
  let lastAllowedAt = -Infinity;

  return () => {
    const current = now();
    if (current - lastAllowedAt < intervalMs) return false;
    lastAllowedAt = current;
    return true;
  };
}
