import { describe, expect, it } from "vitest";
import { buildLoginRequest, loginErrorMessage } from "./login";

describe("buildLoginRequest", () => {
  it("uses the e-mail endpoint when the text has an @", () => {
    expect(buildLoginRequest(" ana@mail.pt ", "secret123")).toEqual({
      path: "/api/auth/sign-in/email",
      body: { email: "ana@mail.pt", password: "secret123" },
    });
  });

  it("uses the username endpoint otherwise", () => {
    expect(buildLoginRequest("Ana_X", "secret123")).toEqual({
      path: "/api/auth/sign-in/username",
      body: { username: "Ana_X", password: "secret123" },
    });
  });

  it("never trims the password", () => {
    expect(buildLoginRequest("ana", " pass word ")?.body.password).toBe(
      " pass word "
    );
  });

  it("returns null when a field is empty", () => {
    expect(buildLoginRequest("  ", "secret123")).toBeNull();
    expect(buildLoginRequest("ana", "")).toBeNull();
  });
});

describe("loginErrorMessage", () => {
  it("is the same for every wrong-credentials answer", () => {
    expect(loginErrorMessage(401)).toBe("Wrong username/e-mail or password");
  });

  it("has its own text for the rate limit and a generic one for the rest", () => {
    expect(loginErrorMessage(429)).toMatch(/too many attempts/i);
    expect(loginErrorMessage(500)).toBe("Login failed, try again");
  });
});
