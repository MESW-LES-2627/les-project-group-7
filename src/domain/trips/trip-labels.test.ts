import { describe, it, expect, afterEach } from "vitest";
import {
  formatDayLabel,
  formatTripDateRange,
  formatTripDuration,
} from "./trip-labels";

describe("formatDayLabel", () => {
  it("gives the day number and the date", () => {
    expect(formatDayLabel(1, "2026-12-01")).toBe("Day 1 — Tue 1 Dec 2026");
  });

  it("crosses the end of the year", () => {
    expect(formatDayLabel(1, "2026-12-31")).toBe("Day 1 — Thu 31 Dec 2026");
    expect(formatDayLabel(2, "2027-01-01")).toBe("Day 2 — Fri 1 Jan 2027");
  });

  describe("in a time zone behind UTC", () => {
    const original = process.env.TZ;
    afterEach(() => {
      // Assigning undefined would store the text "undefined" as the time zone.
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it("does not move the date to the day before", () => {
      process.env.TZ = "America/Los_Angeles";
      expect(formatDayLabel(1, "2027-01-01")).toBe("Day 1 — Fri 1 Jan 2027");
    });
  });
});

describe("formatTripDateRange", () => {
  it("formats range between two dates", () => {
    expect(formatTripDateRange("2026-12-01", "2026-12-03")).toBe(
      "1 Dec 2026 – 3 Dec 2026"
    );
  });

  it("formats a single day trip", () => {
    expect(formatTripDateRange("2026-12-01", "2026-12-01")).toBe("1 Dec 2026");
  });
});

describe("formatTripDuration", () => {
  it("formats 1 day singular", () => {
    expect(formatTripDuration(1)).toBe("1 day");
  });

  it("formats multiple days plural", () => {
    expect(formatTripDuration(3)).toBe("3 days");
    expect(formatTripDuration(14)).toBe("14 days");
  });
});
