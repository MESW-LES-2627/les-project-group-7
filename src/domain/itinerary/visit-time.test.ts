import { describe, it, expect } from "vitest";
import { parseVisitTime, VISIT_TIME_ERROR } from "./visit-time";

describe("parseVisitTime", () => {
  it("accepts a time of the day as HH:mm", () => {
    expect(parseVisitTime("09:30")).toEqual({ ok: true, value: "09:30" });
    expect(parseVisitTime("18:05")).toEqual({ ok: true, value: "18:05" });
  });

  it("accepts the whole day, 00:00 to 23:59, and nothing else decides (AC7)", () => {
    expect(parseVisitTime("00:00")).toEqual({ ok: true, value: "00:00" });
    expect(parseVisitTime("22:30")).toEqual({ ok: true, value: "22:30" });
    expect(parseVisitTime("23:59")).toEqual({ ok: true, value: "23:59" });
  });

  it("means no time for null, undefined and an empty text", () => {
    expect(parseVisitTime(null)).toEqual({ ok: true, value: null });
    expect(parseVisitTime(undefined)).toEqual({ ok: true, value: null });
    expect(parseVisitTime("")).toEqual({ ok: true, value: null });
  });

  it("refuses a time that is not a time of the day", () => {
    for (const value of ["24:00", "23:60", "99:99", "12:75", "-1:00"]) {
      expect(parseVisitTime(value)).toEqual({
        ok: false,
        error: VISIT_TIME_ERROR,
      });
    }
  });

  it("refuses other formats", () => {
    for (const value of [
      "9:30",
      "09:3",
      "0930",
      "09.30",
      "09:30:00",
      " 09:30",
      "09:30 ",
      "9am",
      "noon",
    ]) {
      expect(parseVisitTime(value).ok).toBe(false);
    }
  });

  it("refuses values that are not text", () => {
    for (const value of [930, 9.3, true, {}, [], ["09:30"], new Date()]) {
      expect(parseVisitTime(value)).toEqual({
        ok: false,
        error: VISIT_TIME_ERROR,
      });
    }
  });
});
