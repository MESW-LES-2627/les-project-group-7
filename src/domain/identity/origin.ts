/**
 * Same-site check for requests that change data. A browser always sends the Origin header on a
 * cross-site POST, so a page on another site cannot make a visitor's browser call our endpoints
 * without it showing. A request with no Origin (a script, not a browser) is allowed: it cannot
 * ride on the visitor's cookies.
 *
 * `siteUrl` is the address of the site (BETTER_AUTH_URL). Only the origin part is compared, so a
 * path or a trailing slash does not matter. If it is not a valid address nothing is allowed.
 */
export function isAllowedOrigin(
  originHeader: string | null,
  siteUrl: string
): boolean {
  let site: string;
  try {
    site = new URL(siteUrl).origin;
  } catch {
    return false;
  }

  if (originHeader === null) return true;

  try {
    const origin = new URL(originHeader);
    return origin.origin !== "null" && origin.origin === site;
  } catch {
    return false; // "null" (an opaque origin), an empty header or text that is not an address
  }
}
