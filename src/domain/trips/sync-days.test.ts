import { describe, it, expect } from "vitest";
import { MAX_TRIP_DAYS } from "./trip-days";
import { SYNC_DAYS_ERRORS, syncDays } from "./sync-days";
import type { StoredDay, SyncDaysResult } from "./sync-days";

const date = (text: string) => new Date(`${text}T00:00:00.000Z`);

/** The days a trip has from `start` for `count` days: numbers 1..count, one date each. */
function daysFrom(start: string, count: number): StoredDay[] {
  return Array.from({ length: count }, (_, index) => ({
    dayNumber: index + 1,
    date: new Date(date(start).getTime() + index * 24 * 60 * 60 * 1000),
  }));
}

function changes(result: SyncDaysResult) {
  if (!result.ok) {
    throw new Error(`expected ok, got: ${result.error}`);
  }
  return result;
}

const numbers = (days: { dayNumber: number }[]) =>
  days.map((day) => day.dayNumber);

const texts = (days: { date: Date }[]) =>
  days.map((day) => day.date.toISOString().slice(0, 10));

describe("syncDays: the dates stay the same", () => {
  it("changes nothing", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 3),
        date("2026-12-01"),
        date("2026-12-03")
      )
    );

    expect(result).toEqual({ ok: true, update: [], add: [], remove: [] });
  });
});

describe("syncDays: extend the end date (AC1)", () => {
  it("adds the new empty days at the end and changes none of the others", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 3),
        date("2026-12-01"),
        date("2026-12-05")
      )
    );

    expect(numbers(result.add)).toEqual([4, 5]);
    expect(texts(result.add)).toEqual(["2026-12-04", "2026-12-05"]);
    expect(result.update).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it("works for a one-day trip", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 1),
        date("2026-12-01"),
        date("2026-12-02")
      )
    );

    expect(numbers(result.add)).toEqual([2]);
  });

  it("can go up to the longest trip", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 3),
        date("2026-12-01"),
        date("2026-12-14")
      )
    );

    expect(result.add).toHaveLength(MAX_TRIP_DAYS - 3);
    expect(numbers(result.add).at(-1)).toBe(MAX_TRIP_DAYS);
  });
});

describe("syncDays: shorten the trip (AC2)", () => {
  it("removes the days at the end, never in the middle", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 5),
        date("2026-12-01"),
        date("2026-12-02")
      )
    );

    expect(result.remove).toEqual([3, 4, 5]);
    expect(result.add).toEqual([]);
    expect(result.update).toEqual([]);
  });

  it("can shorten it to a single day", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 4),
        date("2026-12-01"),
        date("2026-12-01")
      )
    );

    expect(result.remove).toEqual([2, 3, 4]);
  });

  it("lists the numbers to remove in order, whatever the order of the days it is given", () => {
    const shuffled = [...daysFrom("2026-12-01", 5)].reverse();

    const result = changes(
      syncDays(shuffled, date("2026-12-01"), date("2026-12-02"))
    );

    expect(result.remove).toEqual([3, 4, 5]);
  });
});

describe("syncDays: move the start date (AC3)", () => {
  it("gives every day its new date and keeps the day numbers", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 3),
        date("2026-12-10"),
        date("2026-12-12")
      )
    );

    expect(numbers(result.update)).toEqual([1, 2, 3]);
    expect(texts(result.update)).toEqual([
      "2026-12-10",
      "2026-12-11",
      "2026-12-12",
    ]);
    expect(result.add).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it("moves the start earlier too", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-10", 2),
        date("2026-12-08"),
        date("2026-12-09")
      )
    );

    expect(texts(result.update)).toEqual(["2026-12-08", "2026-12-09"]);
  });

  it("moves both dates by the same amount without adding or removing days", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 4),
        date("2026-12-20"),
        date("2026-12-23")
      )
    );

    expect(result.update).toHaveLength(4);
    expect(result.add).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it("moves the start and the end at once: the kept days change date, the rest is added", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 2),
        date("2026-12-10"),
        date("2026-12-13")
      )
    );

    expect(numbers(result.update)).toEqual([1, 2]);
    expect(numbers(result.add)).toEqual([3, 4]);
    expect(texts(result.add)).toEqual(["2026-12-12", "2026-12-13"]);
  });

  it("moves the start and shortens at once: the kept days change date, the rest goes", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-01", 4),
        date("2026-12-10"),
        date("2026-12-11")
      )
    );

    expect(numbers(result.update)).toEqual([1, 2]);
    expect(result.remove).toEqual([3, 4]);
  });

  it("only lists the days whose date really changes", () => {
    // Day 1 already has the new date: only days 2 and 3 are out of place.
    const days: StoredDay[] = [
      { dayNumber: 1, date: date("2026-12-01") },
      { dayNumber: 2, date: date("2026-12-20") },
      { dayNumber: 3, date: date("2026-12-21") },
    ];

    const result = changes(
      syncDays(days, date("2026-12-01"), date("2026-12-03"))
    );

    expect(numbers(result.update)).toEqual([2, 3]);
  });
});

describe("syncDays: calendar dates, not clock time", () => {
  it("never adds or removes a day across the change to summer time", () => {
    // In Europe the clocks change on 29 March 2026 and on 25 October 2026.
    const spring = changes(
      syncDays(
        daysFrom("2026-03-27", 5),
        date("2026-03-27"),
        date("2026-03-31")
      )
    );
    const autumn = changes(
      syncDays(
        daysFrom("2026-10-23", 5),
        date("2026-10-23"),
        date("2026-10-27")
      )
    );

    for (const result of [spring, autumn]) {
      expect(result.update).toEqual([]);
      expect(result.add).toEqual([]);
      expect(result.remove).toEqual([]);
    }
  });

  it("goes over the end of a month and of a year", () => {
    const result = changes(
      syncDays(
        daysFrom("2026-12-30", 1),
        date("2026-12-30"),
        date("2027-01-02")
      )
    );

    expect(texts(result.add)).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("knows 29 February", () => {
    const result = changes(
      syncDays(
        daysFrom("2028-02-28", 1),
        date("2028-02-28"),
        date("2028-03-01")
      )
    );

    expect(texts(result.add)).toEqual(["2028-02-29", "2028-03-01"]);
  });
});

describe("syncDays: invalid dates change nothing (AC4)", () => {
  const days = daysFrom("2026-12-01", 3);

  it("refuses an end date before the start date", () => {
    expect(syncDays(days, date("2026-12-05"), date("2026-12-04"))).toEqual({
      ok: false,
      error: SYNC_DAYS_ERRORS.endBeforeStart,
    });
  });

  it("refuses a trip of more than 14 days", () => {
    expect(syncDays(days, date("2026-12-01"), date("2026-12-15"))).toEqual({
      ok: false,
      error: SYNC_DAYS_ERRORS.tooManyDays,
    });
  });

  it("accepts a trip of exactly 14 days", () => {
    expect(syncDays(days, date("2026-12-01"), date("2026-12-14")).ok).toBe(
      true
    );
  });

  it("refuses a date that does not exist", () => {
    const missing = new Date(Number.NaN); // an Invalid Date
    const notAWholeDay = new Date("2026-12-01T10:30:00.000Z");

    expect(syncDays(days, missing, date("2026-12-03"))).toEqual({
      ok: false,
      error: SYNC_DAYS_ERRORS.invalidDate,
    });
    expect(syncDays(days, date("2026-12-01"), missing)).toEqual({
      ok: false,
      error: SYNC_DAYS_ERRORS.invalidDate,
    });
    expect(syncDays(days, notAWholeDay, date("2026-12-03"))).toEqual({
      ok: false,
      error: SYNC_DAYS_ERRORS.invalidDate,
    });
  });

  it("refuses values that are not dates", () => {
    const text = "2026-12-01" as unknown as Date;

    expect(syncDays(days, text, date("2026-12-03"))).toEqual({
      ok: false,
      error: SYNC_DAYS_ERRORS.invalidDate,
    });
  });

  it("does not change the days it was given", () => {
    const before = JSON.stringify(days);

    syncDays(days, date("2026-12-10"), date("2026-12-20"));
    syncDays(days, date("2026-12-10"), date("2026-12-02"));

    expect(JSON.stringify(days)).toBe(before);
  });
});

describe("syncDays: a trip with gaps in its numbers", () => {
  it("fills the missing numbers and removes only the ones past the end", () => {
    const damaged: StoredDay[] = [
      { dayNumber: 1, date: date("2026-12-01") },
      { dayNumber: 3, date: date("2026-12-03") },
      { dayNumber: 6, date: date("2026-12-06") },
    ];

    const result = changes(
      syncDays(damaged, date("2026-12-01"), date("2026-12-04"))
    );

    expect(numbers(result.add)).toEqual([2, 4]);
    expect(result.remove).toEqual([6]);
    expect(result.update).toEqual([]);
  });
});
