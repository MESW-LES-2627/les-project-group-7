import { isAllowedOrigin } from "./origin";

/**
 * Who may call an endpoint (US-A1-02, acceptance criteria 4 and 5). Pure function, so it is
 * tested without the authentication library, src/lib/guard.ts feeds it the real request.
 */
export type AccessDecision =
  { ok: true } | { ok: false; status: 401 | 403; error: string };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function decideAccess(input: {
  method: string;
  originHeader: string | null;
  siteUrl: string;
  loggedIn: boolean;
}): AccessDecision {
  const changesData = !SAFE_METHODS.has(input.method.toUpperCase());

  if (changesData && !isAllowedOrigin(input.originHeader, input.siteUrl)) {
    return { ok: false, status: 403, error: "Invalid origin" };
  }
  if (!input.loggedIn) {
    return { ok: false, status: 401, error: "Log in to do this" };
  }
  return { ok: true };
}
