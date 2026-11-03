import { describe, it, expect } from "vitest";
import { DEFAULT_DEMO_PASSWORD, DEMO_USERS, demoPassword } from "./demo-users";
import { validateRegistration } from "./registration";

describe("DEMO_USERS", () => {
  it("each passes the registration rules, so it looks like an account made on /register", () => {
    for (const user of DEMO_USERS) {
      const result = validateRegistration({
        username: user.username,
        email: user.email,
        password: DEFAULT_DEMO_PASSWORD,
      });
      expect(result.ok, user.username).toBe(true);
    }
  });

  it("are stored in lower case, as the authentication library stores usernames and e-mails", () => {
    for (const user of DEMO_USERS) {
      expect(user.username).toBe(user.username.toLowerCase());
      expect(user.email).toBe(user.email.toLowerCase());
    }
  });

  it("have different ids, usernames and e-mails", () => {
    for (const field of ["id", "username", "email"] as const) {
      const values = DEMO_USERS.map((user) => user[field]);
      expect(new Set(values).size, field).toBe(values.length);
    }
  });
});

describe("demoPassword", () => {
  it("is the documented default when DEMO_PASSWORD is not set or empty", () => {
    expect(demoPassword(undefined)).toBe(DEFAULT_DEMO_PASSWORD);
    expect(demoPassword("")).toBe(DEFAULT_DEMO_PASSWORD);
  });

  it("is DEMO_PASSWORD when it is set", () => {
    expect(demoPassword("another-password-9")).toBe("another-password-9");
  });

  it("refuses a DEMO_PASSWORD that breaks the password rules", () => {
    expect(() => demoPassword("short")).toThrow(/8 to 128/);
    expect(() => demoPassword("x".repeat(129))).toThrow(/8 to 128/);
  });

  it("has a default that passes the password rules", () => {
    expect(() => demoPassword(DEFAULT_DEMO_PASSWORD)).not.toThrow();
  });
});
