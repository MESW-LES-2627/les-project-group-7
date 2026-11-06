import { describe, it, expect } from "vitest";
import { formatOpeningHours } from "./opening-hours";

describe("formatOpeningHours", () => {
  it("formats weekday ranges", () => {
    expect(formatOpeningHours("Mo-Fr 09:00-18:00")).toBe(
      "Monday–Friday: 09:00–18:00"
    );
  });

  it("formats opening hours for every day", () => {
    expect(formatOpeningHours("Mo-Su 09:30-19:00")).toBe(
      "Monday–Sunday: 09:30–19:00"
    );
  });

  it("formats 24/7 opening hours", () => {
    expect(formatOpeningHours("24/7")).toBe("Open 24 hours, every day");
  });

  it("formats 24-hour schedules with weekdays", () => {
    expect(formatOpeningHours("Mo-Su 24h")).toBe(
      "Monday–Sunday: Open 24 hours"
    );
  });

  it("formats closed days", () => {
    expect(formatOpeningHours("Mo-Sa 10:00-20:00; Su off")).toBe(
      "Monday–Saturday: 10:00–20:00; Sunday: Closed"
    );
  });

  it("formats multiple opening intervals", () => {
    expect(formatOpeningHours("Tu-Su 10:00-13:00,14:00-18:00")).toBe(
      "Tuesday–Sunday: 10:00–13:00,14:00–18:00"
    );
  });

  it("preserves public holiday exceptions", () => {
    expect(formatOpeningHours("Tu-Su 10:00-17:30; PH off")).toBe(
      "Tuesday–Sunday: 10:00–17:30; PH off"
    );
  });

  it("returns Unknown when opening hours are missing", () => {
    expect(formatOpeningHours(null)).toBe("Unknown");
    expect(formatOpeningHours(undefined)).toBe("Unknown");
    expect(formatOpeningHours("")).toBe("Unknown");
    expect(formatOpeningHours("   ")).toBe("Unknown");
  });

  it("preserves complex seasonal schedules", () => {
    const schedule = "Apr-Oct 09:00-18:30; Nov-Mar 09:00-17:30; easter off";

    expect(formatOpeningHours(schedule)).toBe(
      "Apr-Oct 09:00-18:30; Nov-Mar 09:00-17:30; easter off"
    );
  });

  it("preserves unsupported expressions", () => {
    expect(formatOpeningHours("sunrise-sunset")).toBe("sunrise-sunset");
  });
});
