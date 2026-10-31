import { describe, it, expect } from "vitest";
import {
  registrationFailureFromCode,
  findTakenFields,
} from "./registration-errors";

describe("registrationFailureFromCode", () => {
  it("answers 409 and names the taken username", () => {
    expect(registrationFailureFromCode("USERNAME_IS_ALREADY_TAKEN")).toEqual({
      status: 409,
      errors: { username: "This username is already taken" },
    });
  });

  it("answers 409 and names the taken e-mail", () => {
    for (const code of [
      "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
      "USER_ALREADY_EXISTS",
    ]) {
      expect(registrationFailureFromCode(code)).toEqual({
        status: 409,
        errors: { email: "This e-mail is already registered" },
      });
    }
  });

  it("answers 400 for input the library refuses", () => {
    expect(registrationFailureFromCode("PASSWORD_TOO_SHORT")).toMatchObject({
      status: 400,
      errors: { password: expect.any(String) },
    });
    expect(registrationFailureFromCode("PASSWORD_TOO_LONG")).toMatchObject({
      status: 400,
      errors: { password: expect.any(String) },
    });
    for (const code of [
      "INVALID_USERNAME",
      "USERNAME_TOO_SHORT",
      "USERNAME_TOO_LONG",
    ]) {
      expect(registrationFailureFromCode(code)).toMatchObject({
        status: 400,
        errors: { username: expect.any(String) },
      });
    }
    expect(registrationFailureFromCode("INVALID_EMAIL")).toMatchObject({
      status: 400,
      errors: { email: expect.any(String) },
    });
  });

  it("returns null for a code it does not know, so the caller can answer 500", () => {
    expect(registrationFailureFromCode("FAILED_TO_CREATE_USER")).toBeNull();
    expect(registrationFailureFromCode(undefined)).toBeNull();
    expect(registrationFailureFromCode(42)).toBeNull();
  });
});

describe("findTakenFields", () => {
  const wanted = { username: "Ana_Silva", email: "ana@example.com" };

  it("returns nothing when no existing user matches", () => {
    expect(findTakenFields([], wanted)).toEqual({});
    expect(
      findTakenFields(
        [{ username: "bruno", email: "bruno@example.com" }],
        wanted
      )
    ).toEqual({});
  });

  it("finds a taken username, ignoring the case", () => {
    expect(
      findTakenFields(
        [{ username: "ana_silva", email: "other@example.com" }],
        wanted
      )
    ).toEqual({ username: "This username is already taken" });
  });

  it("finds a taken e-mail, ignoring the case", () => {
    expect(
      findTakenFields(
        [{ username: "someone", email: "ANA@example.com" }],
        wanted
      )
    ).toEqual({ email: "This e-mail is already registered" });
  });

  it("reports both fields when they belong to different users or to the same one", () => {
    const expected = {
      username: "This username is already taken",
      email: "This e-mail is already registered",
    };
    expect(
      findTakenFields(
        [
          { username: "ana_silva", email: "x@example.com" },
          { username: "other", email: "ana@example.com" },
        ],
        wanted
      )
    ).toEqual(expected);
    expect(
      findTakenFields(
        [{ username: "ana_silva", email: "ana@example.com" }],
        wanted
      )
    ).toEqual(expected);
  });
});
