import { prisma } from "@/lib/prisma";
import {
  REGISTER_WINDOW_MS,
  rateLimitDecision,
} from "@/domain/identity/register-rate-limit";

/**
 * Counts one registration attempt for an address and says if it may go on. The counter is a row
 * of the RateLimit table (the one the authentication library uses for its own limits, with its
 * own keys), updated in a single statement so two requests at the same moment cannot both read
 * the old count. In this row "lastRequest" holds the start of the current window.
 */
export async function consumeRegisterAttempt(address: string) {
  const now = Date.now();
  const windowStart = now - REGISTER_WINDOW_MS;
  const key = `register:${address}`;

  const rows = await prisma.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${crypto.randomUUID()}, ${key}, 1, ${BigInt(now)}::bigint)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(windowStart)}::bigint
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(windowStart)}::bigint
                           THEN ${BigInt(now)}::bigint ELSE "RateLimit"."lastRequest" END
    RETURNING "count", "lastRequest"`;

  const { count, lastRequest } = rows[0];
  return rateLimitDecision(Number(count), Number(lastRequest), now);
}
