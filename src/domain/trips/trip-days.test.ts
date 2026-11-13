import { describe, it, expect } from "vitest";
import {
  buildTripDays,
  countTripDays,
  formatDateOnly,
  MAX_TRIP_DAYS,
  parseDateOnly,
  startOfTodayInTimeZone,
} from "./trip-days";

const date = (text: string) => new Date(`${text}T00:00:00.000Z`);

describe("parseDateOnly", () => {
  it("reads a YYYY-MM-DD date as midnight UTC", () => {
    expect(parseDateOnly("2026-12-01")).toEqual(date("2026-12-01"));
  });

  it("accepts 29 February only in a leap year", () => {
    expect(parseDateOnly("2028-02-29")).toEqual(date("2028-02-29"));
    expect(parseDateOnly("2027-02-29")).toBeNull();
  });

  it("rejects dates that do not exist instead of rolling them over", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-04-31")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-00-10")).toBeNull();
    expect(parseDateOnly("2026-12-00")).toBeNull();
  });

  it("rejects other formats and values that are not text", () => {
    expect(parseDateOnly("1/12/2026")).toBeNull();
    expect(parseDateOnly("2026-1-5")).toBeNull();
    expect(parseDateOnly("2026-12-01T10:00:00Z")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly(20261201)).toBeNull();
  });
});

describe("startOfTodayInTimeZone", () => {
  it("is the date in the city, not the date where the person is", () => {
    // 20:00 UTC on 12 November: Sydney (UTC+11) is already on the 13th, Los Angeles (UTC-8) is on the 12th.
    const now = new Date("2026-11-12T20:00:00.000Z");

    expect(startOfTodayInTimeZone(now, "Australia/Sydney")).toEqual(
      date("2026-11-13")
    );
    expect(startOfTodayInTimeZone(now, "America/Los_Angeles")).toEqual(
      date("2026-11-12")
    );
    expect(startOfTodayInTimeZone(now, "UTC")).toEqual(date("2026-11-12"));
  });

  it("changes date at the midnight of the city", () => {
    // Lisbon is UTC+0 in winter and UTC+1 in summer.
    expect(
      startOfTodayInTimeZone(
        new Date("2026-12-01T23:59:00.000Z"),
        "Europe/Lisbon"
      )
    ).toEqual(date("2026-12-01"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-12-02T00:00:00.000Z"),
        "Europe/Lisbon"
      )
    ).toEqual(date("2026-12-02"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-07-01T22:59:00.000Z"),
        "Europe/Lisbon"
      )
    ).toEqual(date("2026-07-01"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-07-01T23:00:00.000Z"),
        "Europe/Lisbon"
      )
    ).toEqual(date("2026-07-02"));
  });

  it("follows the change of the clock of the city (summer time)", () => {
    // Paris moves its clock forward at 01:00 UTC on 29 March 2026, and back at 01:00 UTC on 25 October.
    expect(
      startOfTodayInTimeZone(
        new Date("2026-03-28T23:30:00.000Z"),
        "Europe/Paris"
      )
    ).toEqual(date("2026-03-29"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-03-29T21:59:00.000Z"),
        "Europe/Paris"
      )
    ).toEqual(date("2026-03-29"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-03-29T22:00:00.000Z"),
        "Europe/Paris"
      )
    ).toEqual(date("2026-03-30"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-10-24T22:30:00.000Z"),
        "Europe/Paris"
      )
    ).toEqual(date("2026-10-25"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-10-25T22:59:00.000Z"),
        "Europe/Paris"
      )
    ).toEqual(date("2026-10-25"));
    expect(
      startOfTodayInTimeZone(
        new Date("2026-10-25T23:00:00.000Z"),
        "Europe/Paris"
      )
    ).toEqual(date("2026-10-26"));
  });

  it("works for the zones that are far from UTC, in both directions", () => {
    const now = new Date("2026-11-12T10:30:00.000Z");

    expect(startOfTodayInTimeZone(now, "Pacific/Kiritimati")).toEqual(
      date("2026-11-13")
    ); // UTC+14
    expect(startOfTodayInTimeZone(now, "Pacific/Pago_Pago")).toEqual(
      date("2026-11-11") // UTC-11
    );
  });

  it("counts a name that is not a time zone as UTC", () => {
    const now = new Date("2026-11-12T20:00:00.000Z");

    expect(startOfTodayInTimeZone(now, "Nowhere/City")).toEqual(
      date("2026-11-12")
    );
    expect(startOfTodayInTimeZone(now, "")).toEqual(date("2026-11-12"));
  });
});

describe("formatDateOnly", () => {
  it("gives back the YYYY-MM-DD text", () => {
    expect(formatDateOnly(date("2026-12-01"))).toBe("2026-12-01");
  });
});

describe("countTripDays", () => {
  it("counts both the first and the last date", () => {
    expect(countTripDays(date("2026-12-01"), date("2026-12-03"))).toBe(3);
  });

  it("is 1 day for a trip that starts and ends on the same date", () => {
    expect(countTripDays(date("2026-12-01"), date("2026-12-01"))).toBe(1);
  });

  it("counts across a change of month and of year", () => {
    expect(countTripDays(date("2026-11-29"), date("2026-12-02"))).toBe(4);
    expect(countTripDays(date("2026-12-30"), date("2027-01-02"))).toBe(4);
  });

  it("counts the 29th of February of a leap year", () => {
    expect(countTripDays(date("2028-02-28"), date("2028-03-01"))).toBe(3);
    expect(countTripDays(date("2027-02-28"), date("2027-03-01"))).toBe(2);
  });

  it("is not changed by the change of the clock (summer time)", () => {
    // Europe changes the clock on 29 March and 25 October 2026.
    expect(countTripDays(date("2026-03-28"), date("2026-03-30"))).toBe(3);
    expect(countTripDays(date("2026-10-24"), date("2026-10-26"))).toBe(3);
  });

  it("is 0 when the end date is before the start date", () => {
    expect(countTripDays(date("2026-12-03"), date("2026-12-01"))).toBe(0);
  });

  it("knows the longest trip is 14 days", () => {
    expect(MAX_TRIP_DAYS).toBe(14);
    expect(countTripDays(date("2026-12-01"), date("2026-12-14"))).toBe(
      MAX_TRIP_DAYS
    );
  });
});

describe("buildTripDays", () => {
  it("gives one day for each date, numbered from 1, from the start to the end date", () => {
    const days = buildTripDays(date("2026-12-01"), date("2026-12-03"));

    expect(days).toEqual([
      { dayNumber: 1, date: date("2026-12-01") },
      { dayNumber: 2, date: date("2026-12-02") },
      { dayNumber: 3, date: date("2026-12-03") },
    ]);
  });

  it("gives a single day when the trip starts and ends on the same date", () => {
    expect(buildTripDays(date("2026-12-01"), date("2026-12-01"))).toEqual([
      { dayNumber: 1, date: date("2026-12-01") },
    ]);
  });

  it("goes over the end of the month and over the change of the clock", () => {
    const days = buildTripDays(date("2026-03-30"), date("2026-04-02"));

    expect(days.map((day) => formatDateOnly(day.date))).toEqual([
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
    ]);
  });

  it("gives no days when the end date is before the start date", () => {
    expect(buildTripDays(date("2026-12-03"), date("2026-12-01"))).toEqual([]);
  });

  it("always gives as many days as countTripDays", () => {
    const start = date("2026-10-20");
    const end = date("2026-11-02");

    expect(buildTripDays(start, end)).toHaveLength(countTripDays(start, end));
  });
});
