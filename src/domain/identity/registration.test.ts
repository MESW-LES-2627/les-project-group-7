import { describe, it, expect } from "vitest";
import { validateRegistration } from "./registration";

const valid = {
  username: "Ana_Silva",
  email: "ana@example.com",
  password: "correct-horse-9",
};

describe("validateRegistration", () => {
  it("accepts valid input and cleans it", () => {
    const result = validateRegistration({
      username: "  Ana_Silva ",
      email: "  Ana@Example.COM ",
      password: "correct-horse-9",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        username: "Ana_Silva",
        email: "ana@example.com",
        password: "correct-horse-9",
      },
    });
  });

  describe("username", () => {
    it("is required", () => {
      for (const username of ["", "   ", undefined, null, 42]) {
        const result = validateRegistration({ ...valid, username });
        expect(result).toEqual({
          ok: false,
          errors: { username: "Username is required" },
        });
      }
    });

    it("must have 3 to 30 characters", () => {
      const tooShort = validateRegistration({ ...valid, username: "ab" });
      const tooLong = validateRegistration({
        ...valid,
        username: "a".repeat(31),
      });

      expect(tooShort).toMatchObject({
        ok: false,
        errors: { username: "Username must have 3 to 30 characters" },
      });
      expect(tooLong).toMatchObject({
        ok: false,
        errors: { username: "Username must have 3 to 30 characters" },
      });
      expect(validateRegistration({ ...valid, username: "abc" }).ok).toBe(true);
      expect(
        validateRegistration({ ...valid, username: "a".repeat(30) }).ok
      ).toBe(true);
    });

    it("only allows letters, numbers, underscores and dots", () => {
      for (const username of ["bad name", "bad-name", "bad@name", "ação_x"]) {
        expect(validateRegistration({ ...valid, username })).toMatchObject({
          ok: false,
          errors: {
            username:
              "Username can only have letters, numbers, underscores and dots",
          },
        });
      }
      expect(
        validateRegistration({ ...valid, username: "ana.silva_99" }).ok
      ).toBe(true);
    });
  });

  describe("e-mail", () => {
    it("is required", () => {
      for (const email of ["", "  ", undefined, null]) {
        expect(validateRegistration({ ...valid, email })).toEqual({
          ok: false,
          errors: { email: "E-mail is required" },
        });
      }
    });

    it("must look like an e-mail", () => {
      for (const email of [
        "not-an-email",
        "ana@",
        "@example.com",
        "ana@example",
        "ana @example.com",
        "ana@@example.com",
      ]) {
        expect(validateRegistration({ ...valid, email })).toEqual({
          ok: false,
          errors: { email: "Enter a valid e-mail" },
        });
      }
    });

    it("is refused when it is longer than 254 characters", () => {
      const email = `${"a".repeat(250)}@example.com`;
      expect(validateRegistration({ ...valid, email })).toMatchObject({
        ok: false,
        errors: { email: "Enter a valid e-mail" },
      });
    });
  });

  describe("password", () => {
    it("is required", () => {
      for (const password of ["", undefined, null]) {
        expect(validateRegistration({ ...valid, password })).toEqual({
          ok: false,
          errors: { password: "Password is required" },
        });
      }
    });

    it("must have 8 to 128 characters", () => {
      expect(
        validateRegistration({ ...valid, password: "1234567" })
      ).toMatchObject({
        ok: false,
        errors: { password: "Password must have 8 to 128 characters" },
      });
      expect(
        validateRegistration({ ...valid, password: "x".repeat(129) })
      ).toMatchObject({
        ok: false,
        errors: { password: "Password must have 8 to 128 characters" },
      });
      expect(validateRegistration({ ...valid, password: "12345678" }).ok).toBe(
        true
      );
      expect(
        validateRegistration({ ...valid, password: "x".repeat(128) }).ok
      ).toBe(true);
    });

    it("is never trimmed", () => {
      const result = validateRegistration({ ...valid, password: "  spaced  " });
      expect(result).toMatchObject({
        ok: true,
        value: { password: "  spaced  " },
      });
    });
  });

  it("reports every wrong field at once, one message each", () => {
    expect(
      validateRegistration({ username: "", email: "nope", password: "short" })
    ).toEqual({
      ok: false,
      errors: {
        username: "Username is required",
        email: "Enter a valid e-mail",
        password: "Password must have 8 to 128 characters",
      },
    });
  });

  it("treats a missing or non-object body as empty input", () => {
    for (const body of [undefined, null, "text", 7, []]) {
      expect(validateRegistration(body)).toEqual({
        ok: false,
        errors: {
          username: "Username is required",
          email: "E-mail is required",
          password: "Password is required",
        },
      });
    }
  });
});
