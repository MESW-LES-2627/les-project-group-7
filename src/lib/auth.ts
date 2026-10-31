import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

/**
 * Authentication (ADR-009): Better Auth with e-mail and password and a username.
 *
 * - Passwords are hashed by the library (scrypt) and stored in the Account table.
 * - Sessions live in the database (table Session), last 7 days and can be revoked.
 * - Needs BETTER_AUTH_SECRET (at least 32 characters) and BETTER_AUTH_URL in the environment.
 * - To read the logged-in user in a route handler: auth.api.getSession({ headers: request.headers }).
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [username()],
  user: {
    // Our User table already has this column, so the library does not add a second createdAt.
    fields: { createdAt: "registeredAt" },
    additionalFields: {
      // Same values as the Role enum. input: false means a sign-up request cannot set it.
      role: {
        type: "string",
        required: false,
        defaultValue: "USER",
        input: false,
      },
    },
  },
  // Counters in the database: the default memory storage does not suit serverless (Vercel).
  // Enabled everywhere, not only in production, so that what we test locally is what runs live.
  // Limits: 3 sign-ins by e-mail in 10 seconds, 100 requests in 10 seconds for the other endpoints.
  rateLimit: { enabled: true, storage: "database" },
  telemetry: { enabled: false },
});
