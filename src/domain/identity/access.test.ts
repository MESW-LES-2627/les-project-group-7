import { describe, it, expect } from "vitest";
import { decideAccess } from "./access";

const SITE = "https://les-group7.vercel.app";

const post = {
  method: "POST",
  originHeader: SITE as string | null,
  siteUrl: SITE,
  loggedIn: true,
};

describe("decideAccess", () => {
  it("lets a logged-in user write from the site's own pages", () => {
    expect(decideAccess(post)).toEqual({ ok: true });
  });

  it("answers 401 to a write by someone who is not logged in", () => {
    expect(decideAccess({ ...post, loggedIn: false })).toEqual({
      ok: false,
      status: 401,
      error: "Log in to do this",
    });
  });

  it("answers 403 to a write that comes from another site, even if the cookie is valid", () => {
    expect(
      decideAccess({ ...post, originHeader: "https://evil.example" })
    ).toEqual({ ok: false, status: 403, error: "Invalid origin" });
  });

  it("checks the origin before the login, so another site learns nothing about the session", () => {
    expect(
      decideAccess({
        ...post,
        originHeader: "https://evil.example",
        loggedIn: false,
      })
    ).toMatchObject({ status: 403 });
  });

  it("accepts a write with no Origin header (a script, not a browser)", () => {
    expect(decideAccess({ ...post, originHeader: null })).toEqual({ ok: true });
  });

  it("checks the origin for every method that changes data", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        decideAccess({ ...post, method, originHeader: "https://evil.example" })
      ).toMatchObject({ ok: false, status: 403 });
    }
  });

  it("does not check the origin of a read, but still needs the login", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(
        decideAccess({ ...post, method, originHeader: "https://evil.example" })
      ).toEqual({ ok: true });
      expect(decideAccess({ ...post, method, loggedIn: false })).toMatchObject({
        ok: false,
        status: 401,
      });
    }
  });

  it("treats the method in any letter case", () => {
    expect(
      decideAccess({
        ...post,
        method: "post",
        originHeader: "https://evil.example",
      })
    ).toMatchObject({ status: 403 });
  });
});
