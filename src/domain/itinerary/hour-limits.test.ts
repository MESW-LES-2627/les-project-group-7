import { describe, it, expect } from "vitest";
import { isOutsideHourLimits } from "./hour-limits";

describe("isOutsideHourLimits: both limits set", () => {
  it("warns for a time after the end of the day (AC6)", () => {
    expect(isOutsideHourLimits("09:00", "20:00", "21:30")).toBe(true);
  });

  it("warns for a time before the start of the day", () => {
    expect(isOutsideHourLimits("09:00", "20:00", "07:45")).toBe(true);
  });

  it("does not warn for a time inside the limits (AC7)", () => {
    expect(isOutsideHourLimits("09:00", "20:00", "10:00")).toBe(false);
    expect(isOutsideHourLimits("09:00", "20:00", "13:30")).toBe(false);
  });

  it("does not warn for a time right on a limit: the limits are part of the day", () => {
    expect(isOutsideHourLimits("09:00", "20:00", "09:00")).toBe(false);
    expect(isOutsideHourLimits("09:00", "20:00", "20:00")).toBe(false);
  });

  it("warns one minute past either limit", () => {
    expect(isOutsideHourLimits("09:00", "20:00", "08:59")).toBe(true);
    expect(isOutsideHourLimits("09:00", "20:00", "20:01")).toBe(true);
  });

  it("works at the first and the last minute of the day", () => {
    expect(isOutsideHourLimits("00:00", "23:59", "00:00")).toBe(false);
    expect(isOutsideHourLimits("00:00", "23:59", "23:59")).toBe(false);
    expect(isOutsideHourLimits("08:00", "22:00", "00:00")).toBe(true);
    expect(isOutsideHourLimits("08:00", "22:00", "23:59")).toBe(true);
  });

  it("compares the hours, not only the minutes", () => {
    expect(isOutsideHourLimits("09:30", "18:15", "10:00")).toBe(false);
    expect(isOutsideHourLimits("09:30", "18:15", "09:15")).toBe(true);
    expect(isOutsideHourLimits("09:30", "18:15", "18:20")).toBe(true);
  });
});

describe("isOutsideHourLimits: a limit that is not set never warns (AC8)", () => {
  it("only the start: warns before it, never late in the day", () => {
    expect(isOutsideHourLimits("09:00", null, "08:00")).toBe(true);
    expect(isOutsideHourLimits("09:00", null, "23:00")).toBe(false);
  });

  it("only the end: warns after it, never early in the day", () => {
    expect(isOutsideHourLimits(null, "20:00", "21:30")).toBe(true);
    expect(isOutsideHourLimits(null, "20:00", "06:00")).toBe(false);
  });

  it("no limits: never warns", () => {
    for (const time of ["00:00", "06:00", "12:00", "21:30", "23:59"]) {
      expect(isOutsideHourLimits(null, null, time)).toBe(false);
    }
  });

  it("reads an empty text or undefined as a limit that is not set", () => {
    expect(isOutsideHourLimits("", "", "23:00")).toBe(false);
    expect(isOutsideHourLimits(undefined, undefined, "23:00")).toBe(false);
    expect(isOutsideHourLimits("", "20:00", "21:00")).toBe(true);
  });
});

describe("isOutsideHourLimits: what cannot be read never warns", () => {
  it("a stop without a visit time", () => {
    expect(isOutsideHourLimits("09:00", "20:00", null)).toBe(false);
    expect(isOutsideHourLimits("09:00", "20:00", undefined)).toBe(false);
    expect(isOutsideHourLimits("09:00", "20:00", "")).toBe(false);
  });

  it("a visit time that is not HH:mm", () => {
    for (const time of ["24:00", "9:30", "21:60", "21:30:00", "late"]) {
      expect(isOutsideHourLimits("09:00", "20:00", time)).toBe(false);
    }
  });

  it("a limit that is not HH:mm is read as not set, the other one still counts", () => {
    expect(isOutsideHourLimits("9am", "20:00", "06:00")).toBe(false);
    expect(isOutsideHourLimits("9am", "20:00", "21:30")).toBe(true);
    expect(isOutsideHourLimits("09:00", "25:00", "23:00")).toBe(false);
    expect(isOutsideHourLimits("09:00", "25:00", "08:00")).toBe(true);
  });
});
