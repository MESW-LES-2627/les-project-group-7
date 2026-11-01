import { auth } from "@/lib/auth";
import { decideAccess } from "@/domain/identity/access";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
export type SessionUser = Session["user"];

/**
 * The guard of every endpoint that needs a logged-in user (ADR-009). The user always comes from
 * the session cookie, never from the request body.
 *
 *   const guard = await requireUser(request);
 *   if (!guard.ok) return guard.response;   // 401 not logged in, 403 request from another site
 *   const { user } = guard;
 */
export async function requireUser(
  request: Request
): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: Response }
> {
  const session = await auth.api.getSession({ headers: request.headers });

  const decision = decideAccess({
    method: request.method,
    originHeader: request.headers.get("origin"),
    siteUrl: process.env.BETTER_AUTH_URL ?? new URL(request.url).origin,
    loggedIn: session !== null,
  });

  if (!decision.ok || session === null) {
    const status = decision.ok ? 401 : decision.status;
    const error = decision.ok ? "Log in to do this" : decision.error;
    return { ok: false, response: Response.json({ error }, { status }) };
  }
  return { ok: true, user: session.user };
}
