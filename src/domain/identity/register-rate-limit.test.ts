import { describe, it, expect } from "vitest";
import {
  REGISTER_MAX_ATTEMPTS,
  REGISTER_WINDOW_MS,
  clientAddress,
  rateLimitDecision,
} from "./register-rate-limit";

describe("clientAddress", () => {
  it("takes the first address of x-forwarded-for, trimmed", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.7 , 10.0.0.1, 10.0.0.2",
    });
    expect(clientAddress(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4"
    );
    expect(clientAddress(new Headers())).toBe("unknown");
    expect(clientAddress(new Headers({ "x-forwarded-for": " " }))).toBe(
      "unknown"
    );
  });

  it("keeps the address short so a huge header cannot become a huge key", () => {
    const long = "1".repeat(500);
    expect(clientAddress(new Headers({ "x-forwarded-for": long })).length).toBe(
      64
    );
  });
});

describe("rateLimitDecision", () => {
  const start = 1_000_000;

  it("allows the attempts up to the maximum", () => {
    expect(rateLimitDecision(1, start, start + 5).allowed).toBe(true);
    expect(
      rateLimitDecision(REGISTER_MAX_ATTEMPTS, start, start + 5).allowed
    ).toBe(true);
  });

  it("refuses the attempt after the maximum and says how long to wait", () => {
    const decision = rateLimitDecision(
      REGISTER_MAX_ATTEMPTS + 1,
      start,
      start + 60_000
    );
    expect(decision.allowed).toBe(false);
    // 10 minutes window, 1 minute used: 9 minutes left
    expect(decision.retryAfterSeconds).toBe(540);
  });

  it("rounds the wait up to a whole second and never goes below 1", () => {
    expect(
      rateLimitDecision(
        REGISTER_MAX_ATTEMPTS + 1,
        start,
        start + REGISTER_WINDOW_MS - 400
      ).retryAfterSeconds
    ).toBe(1);
    expect(
      rateLimitDecision(
        REGISTER_MAX_ATTEMPTS + 1,
        start,
        start + REGISTER_WINDOW_MS + 5_000
      ).retryAfterSeconds
    ).toBe(1);
  });
});
