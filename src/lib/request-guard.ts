import { isAllowedOrigin } from "@/domain/identity/origin";

/**
 * Only our own pages may call a write endpoint. A form on another site could send a text/plain
 * body without a preflight and act in a visitor's browser (login CSRF), so the body must be JSON
 * and the Origin must be this site. Returns the error answer, or null when the request may go on.
 */
export function rejectCrossSiteRequest(request: Request): Response | null {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  const siteUrl = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
  if (!isAllowedOrigin(request.headers.get("origin"), siteUrl)) {
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null;
}
