import { describe, it, expect } from "vitest";
import { isAllowedOrigin } from "./origin";

const SITE = "https://les-group7.vercel.app";

describe("isAllowedOrigin", () => {
  it("allows the site's own origin", () => {
    expect(isAllowedOrigin("https://les-group7.vercel.app", SITE)).toBe(true);
  });

  it("allows a request that sends no Origin (a script, not a browser)", () => {
    expect(isAllowedOrigin(null, SITE)).toBe(true);
  });

  it("ignores a path or a trailing slash in the site address", () => {
    expect(isAllowedOrigin("https://les-group7.vercel.app", `${SITE}/`)).toBe(
      true
    );
    expect(
      isAllowedOrigin("https://les-group7.vercel.app", `${SITE}/some/path`)
    ).toBe(true);
  });

  it("refuses another site", () => {
    expect(isAllowedOrigin("https://evil.example", SITE)).toBe(false);
  });

  it("refuses a lookalike host, another scheme or another port", () => {
    expect(
      isAllowedOrigin("https://les-group7.vercel.app.evil.example", SITE)
    ).toBe(false);
    expect(isAllowedOrigin("http://les-group7.vercel.app", SITE)).toBe(false);
    expect(isAllowedOrigin("https://les-group7.vercel.app:8443", SITE)).toBe(
      false
    );
    expect(isAllowedOrigin("https://les-group7-dev.vercel.app", SITE)).toBe(
      false
    );
  });

  it("refuses the opaque origin 'null' and text that is not an address", () => {
    expect(isAllowedOrigin("null", SITE)).toBe(false);
    expect(isAllowedOrigin("not a url", SITE)).toBe(false);
    expect(isAllowedOrigin("", SITE)).toBe(false);
  });

  it("works for the local address", () => {
    expect(
      isAllowedOrigin("http://localhost:3000", "http://localhost:3000")
    ).toBe(true);
    expect(
      isAllowedOrigin("http://127.0.0.1:3000", "http://localhost:3000")
    ).toBe(false);
  });

  it("refuses everything when the site address itself is not valid", () => {
    expect(isAllowedOrigin("https://les-group7.vercel.app", "oops")).toBe(
      false
    );
  });
});
