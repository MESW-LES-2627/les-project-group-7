import { describe, it, expect, afterEach } from "vitest";
import { formatDayLabel } from "./trip-labels";

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
