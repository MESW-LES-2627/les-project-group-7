import { describe, it, expect } from "vitest";
import {
  formatOpeningHours,
  isOutsideOpeningHours,
  openingStatus,
} from "./opening-hours";

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

// 30 Nov 2026 is a Monday. Day.date is stored as midnight UTC (see trip-days.ts), so the weekday is
// read in UTC.
const MONDAY = Date.UTC(2026, 10, 30);
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type Weekday = (typeof WEEKDAYS)[number];

function on(weekday: Weekday): Date {
  return new Date(MONDAY + WEEKDAYS.indexOf(weekday) * DAY_MS);
}

function toTime(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Every minute of the day, "00:00" to "23:59". */
const ALL_TIMES = Array.from({ length: 1440 }, (_, minute) => toTime(minute));

/** The minutes of the day (0 to 1439) on which `hours` says the place is closed, on `weekday`. */
function closedMinutes(hours: string, weekday: Weekday): number[] {
  return ALL_TIMES.flatMap((time, minute) =>
    isOutsideOpeningHours(hours, on(weekday), time) ? [minute] : []
  );
}

describe("isOutsideOpeningHours: the acceptance criteria of US-E6-01", () => {
  const OPEN_9_TO_18 = "Mo-Su 09:00-18:00";

  it("AC1: a place open 09:00-18:00, a visit at 20:00, the stop is outside the hours", () => {
    expect(isOutsideOpeningHours(OPEN_9_TO_18, on("Mo"), "20:00")).toBe(true);
  });

  it("AC2: a place open 09:00-18:00, a visit at 10:00, no warning", () => {
    expect(isOutsideOpeningHours(OPEN_9_TO_18, on("Mo"), "10:00")).toBe(false);
  });

  it("AC3: unknown opening hours never warn, for any time of the day", () => {
    for (const unknown of [null, undefined, "", "   "]) {
      expect(
        ALL_TIMES.filter((t) => isOutsideOpeningHours(unknown, on("Mo"), t))
      ).toEqual([]);
    }
  });

  it("AC4: the answer depends only on the time given, so a valid time clears the warning", () => {
    expect(isOutsideOpeningHours(OPEN_9_TO_18, on("Mo"), "20:00")).toBe(true);
    expect(isOutsideOpeningHours(OPEN_9_TO_18, on("Mo"), "10:00")).toBe(false);
    expect(isOutsideOpeningHours(OPEN_9_TO_18, on("Mo"), "20:00")).toBe(true);
  });

  it("AC5: opening hours that depend on the weekday use the day of the visit", () => {
    const hours = "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off";

    expect(isOutsideOpeningHours(hours, on("We"), "16:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Sa"), "16:00")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Sa"), "11:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Su"), "11:00")).toBe(true);
  });
});

describe("isOutsideOpeningHours: each criterion from several angles", () => {
  // AC1 and AC2 as a table: the same place, many times of the day.
  it.each([
    ["00:00", true],
    ["08:59", true],
    ["09:00", false],
    ["09:01", false],
    ["12:30", false],
    ["17:59", false],
    ["18:00", true],
    ["18:01", true],
    ["20:00", true],
    ["23:59", true],
  ])("Mo-Su 09:00-18:00 at %s: outside is %s", (time, outside) => {
    expect(isOutsideOpeningHours("Mo-Su 09:00-18:00", on("Mo"), time)).toBe(
      outside
    );
  });

  it("AC1 and AC2 by sweeping every minute: closed exactly before 09:00 and from 18:00", () => {
    const closed = closedMinutes("Mo-Su 09:00-18:00", "Tu");

    expect(closed).toHaveLength(9 * 60 + 6 * 60);
    expect(closed.every((m) => m < 9 * 60 || m >= 18 * 60)).toBe(true);
    expect(closed.filter((m) => m >= 9 * 60 && m < 18 * 60)).toEqual([]);
  });

  it("AC1 and AC2 with the opening and the closing time moved around", () => {
    for (const [from, to] of [
      [6, 12],
      [8, 20],
      [10, 23],
      [0, 18],
    ]) {
      const hours = `Mo-Su ${toTime(from * 60)}-${toTime(to * 60)}`;
      const closed = closedMinutes(hours, "We");

      expect(closed.every((m) => m < from * 60 || m >= to * 60)).toBe(true);
      expect(1440 - closed.length).toBe((to - from) * 60);
    }
  });

  it("AC1: the same visit time is outside for a place that opens later, and not for one that opens earlier", () => {
    expect(isOutsideOpeningHours("Mo-Su 10:00-18:00", on("Mo"), "09:30")).toBe(
      true
    );
    expect(isOutsideOpeningHours("Mo-Su 08:00-18:00", on("Mo"), "09:30")).toBe(
      false
    );
  });

  it("AC3: unsupported or garbled expressions are unknown as well, and never throw", () => {
    const unknown = [
      "sunrise-sunset",
      "by appointment",
      "open",
      "Apr-Oct 09:00-18:30; Nov-Mar 09:00-17:30; easter off",
      "Mo-Fr 09:00-12:00; Jul-Aug Mo-Fr 09:00-20:00",
      "Mo-Fr sunrise-sunset",
      "Mo-Fr 25:00-26:00",
      "Mo-Fr 09:00-",
      "09:00",
      "Xx 09:00-18:00",
      ";;;",
      "Mo-Fr",
      "week 1-53/2 Mo 09:00-18:00",
    ];

    for (const hours of unknown) {
      expect(() => closedMinutes(hours, "Mo")).not.toThrow();
      expect(closedMinutes(hours, "Mo"), hours).toEqual([]);
    }
  });

  it("AC3: unknown hours for formatOpeningHours are never a warning either", () => {
    for (const hours of [null, undefined, "", "  "]) {
      expect(formatOpeningHours(hours)).toBe("Unknown");
      expect(isOutsideOpeningHours(hours, on("Mo"), "03:00")).toBe(false);
    }
  });

  it("AC5: every weekday on its own, a rule for one day opens only that day", () => {
    for (const open of WEEKDAYS) {
      const hours = `${open} 09:00-18:00`;

      for (const weekday of WEEKDAYS) {
        expect(
          isOutsideOpeningHours(hours, on(weekday), "10:00"),
          `${hours} on ${weekday}`
        ).toBe(weekday !== open);
      }
    }
  });

  it("AC5: Mo-Fr is open from Monday to Friday and closed on the weekend", () => {
    const outside = WEEKDAYS.filter((day) =>
      isOutsideOpeningHours("Mo-Fr 09:00-18:00", on(day), "12:00")
    );

    expect(outside).toEqual(["Sa", "Su"]);
  });

  it("AC5: the same time gives a different answer on different days of the same place", () => {
    const hours = "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off";
    const outsideAt16 = WEEKDAYS.filter((d) =>
      isOutsideOpeningHours(hours, on(d), "16:00")
    );
    const outsideAt11 = WEEKDAYS.filter((d) =>
      isOutsideOpeningHours(hours, on(d), "11:00")
    );

    expect(outsideAt16).toEqual(["Sa", "Su"]);
    expect(outsideAt11).toEqual(["Su"]);
  });

  it("AC5: the date decides the weekday, a week later is the same day", () => {
    const nextMonday = new Date(on("Mo").getTime() + 7 * DAY_MS);
    const nextSaturday = new Date(on("Sa").getTime() + 7 * DAY_MS);

    expect(
      isOutsideOpeningHours("Mo-Fr 09:00-18:00", nextMonday, "10:00")
    ).toBe(false);
    expect(
      isOutsideOpeningHours("Mo-Fr 09:00-18:00", nextSaturday, "10:00")
    ).toBe(true);
  });

  it("AC5: a Day.date with a time of the day in it still gives that date's weekday", () => {
    const lateOnSaturday = new Date(
      on("Sa").getTime() + 23 * 3600 * 1000 + 59 * 60 * 1000
    );

    expect(
      isOutsideOpeningHours("Mo-Fr 09:00-18:00", lateOnSaturday, "10:00")
    ).toBe(true);
  });
});

describe("isOutsideOpeningHours: the boundaries", () => {
  it("the opening minute is open and the minute before is closed", () => {
    expect(isOutsideOpeningHours("Mo-Su 09:30-18:30", on("Mo"), "09:29")).toBe(
      true
    );
    expect(isOutsideOpeningHours("Mo-Su 09:30-18:30", on("Mo"), "09:30")).toBe(
      false
    );
  });

  it("the closing minute is already closed and the minute before is open", () => {
    expect(isOutsideOpeningHours("Mo-Su 09:30-18:30", on("Mo"), "18:29")).toBe(
      false
    );
    expect(isOutsideOpeningHours("Mo-Su 09:30-18:30", on("Mo"), "18:30")).toBe(
      true
    );
  });

  it("00:00 and 23:59 are handled as any other time", () => {
    expect(isOutsideOpeningHours("Mo-Su 09:00-18:00", on("Mo"), "00:00")).toBe(
      true
    );
    expect(isOutsideOpeningHours("Mo-Su 09:00-18:00", on("Mo"), "23:59")).toBe(
      true
    );
    expect(isOutsideOpeningHours("Mo-Su 00:00-24:00", on("Mo"), "00:00")).toBe(
      false
    );
    expect(isOutsideOpeningHours("Mo-Su 00:00-24:00", on("Mo"), "23:59")).toBe(
      false
    );
  });

  it("a time that is not HH:mm never warns", () => {
    for (const time of [
      "",
      "9:00",
      "24:00",
      "12:60",
      "noon",
      "09:00:00",
      "ab:cd",
    ]) {
      expect(
        isOutsideOpeningHours("Mo-Su 09:00-18:00", on("Mo"), time),
        time
      ).toBe(false);
    }
  });
});

describe("isOutsideOpeningHours: real OpenStreetMap opening_hours", () => {
  it("24/7 is never outside", () => {
    for (const weekday of WEEKDAYS) {
      expect(closedMinutes("24/7", weekday)).toEqual([]);
    }
  });

  it("Mo-Su 24h is never outside", () => {
    expect(closedMinutes("Mo-Su 24h", "Su")).toEqual([]);
  });

  it("a day that is off is outside at every time", () => {
    expect(closedMinutes("Mo-Sa 10:00-20:00; Su off", "Su")).toHaveLength(1440);
    expect(closedMinutes("Mo-Sa 10:00-20:00; Su closed", "Su")).toHaveLength(
      1440
    );
  });

  it("the other days of that place keep their hours", () => {
    expect(closedMinutes("Mo-Sa 10:00-20:00; Su off", "Sa")).toHaveLength(
      14 * 60
    );
  });

  it("two intervals in a day: the lunch break is outside", () => {
    const hours = "Tu-Su 10:00-13:00,14:00-18:00";

    expect(isOutsideOpeningHours(hours, on("Tu"), "11:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Tu"), "13:30")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Tu"), "15:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Mo"), "11:00")).toBe(true);
  });

  it("two intervals written with a space after the comma", () => {
    const hours = "Mo-Fr 09:00-12:00, 13:00-17:00";

    expect(isOutsideOpeningHours(hours, on("Mo"), "12:30")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Mo"), "16:00")).toBe(false);
  });

  it("a public holiday rule is ignored, the weekdays still decide", () => {
    const hours = "Tu-Su 10:00-17:30; PH off";

    expect(isOutsideOpeningHours(hours, on("We"), "12:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("We"), "18:00")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Mo"), "12:00")).toBe(true);
  });

  it("a later rule replaces the earlier one for the days it names", () => {
    const hours = "Mo-Fr 09:00-18:00; We off; Fr 09:00-12:00";

    expect(isOutsideOpeningHours(hours, on("Tu"), "15:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("We"), "15:00")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Fr"), "15:00")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Fr"), "10:00")).toBe(false);
  });

  it("a list of days", () => {
    const hours = "Mo,We,Fr 08:00-12:00";

    expect(isOutsideOpeningHours(hours, on("We"), "09:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Tu"), "09:00")).toBe(true);
  });

  it("a range of days that wraps over the end of the week", () => {
    const hours = "Sa-Mo 10:00-16:00";

    expect(isOutsideOpeningHours(hours, on("Su"), "12:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Mo"), "12:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Tu"), "12:00")).toBe(true);
  });

  it("hours without days are for every day", () => {
    for (const weekday of WEEKDAYS) {
      expect(isOutsideOpeningHours("09:00-18:00", on(weekday), "10:00")).toBe(
        false
      );
      expect(isOutsideOpeningHours("09:00-18:00", on(weekday), "20:00")).toBe(
        true
      );
    }
  });

  it("blanks around the rules and the separators do not matter", () => {
    expect(
      isOutsideOpeningHours(
        "  Mo-Fr   09:00-18:00 ;  Sa off ; ",
        on("Sa"),
        "10:00"
      )
    ).toBe(true);
    expect(
      isOutsideOpeningHours(
        "  Mo-Fr   09:00-18:00 ;  Sa off ; ",
        on("Mo"),
        "10:00"
      )
    ).toBe(false);
  });

  it("every hours string the display accepts, the check answers without throwing", () => {
    const examples = [
      "Mo-Fr 09:00-18:00",
      "Mo-Su 09:30-19:00",
      "24/7",
      "Mo-Su 24h",
      "Mo-Sa 10:00-20:00; Su off",
      "Tu-Su 10:00-13:00,14:00-18:00",
      "Tu-Su 10:00-17:30; PH off",
    ];

    for (const hours of examples) {
      expect(formatOpeningHours(hours)).not.toBe("Unknown");
      expect(() => closedMinutes(hours, "Mo")).not.toThrow();
    }
  });
});

describe("isOutsideOpeningHours: opening hours that cross midnight", () => {
  const BAR = "Mo-Su 18:00-02:00";

  it("the evening is open and the afternoon is closed", () => {
    expect(isOutsideOpeningHours(BAR, on("Mo"), "17:59")).toBe(true);
    expect(isOutsideOpeningHours(BAR, on("Mo"), "18:00")).toBe(false);
    expect(isOutsideOpeningHours(BAR, on("Mo"), "23:59")).toBe(false);
  });

  it("the small hours of the day belong to the evening before", () => {
    expect(isOutsideOpeningHours(BAR, on("Tu"), "00:00")).toBe(false);
    expect(isOutsideOpeningHours(BAR, on("Tu"), "01:59")).toBe(false);
    expect(isOutsideOpeningHours(BAR, on("Tu"), "02:00")).toBe(true);
    expect(isOutsideOpeningHours(BAR, on("Tu"), "03:00")).toBe(true);
  });

  it("by sweeping a day: closed from 02:00 to 18:00, which is 16 hours", () => {
    const closed = closedMinutes(BAR, "We");

    expect(closed).toHaveLength(16 * 60);
    expect(closed[0]).toBe(2 * 60);
    expect(closed[closed.length - 1]).toBe(18 * 60 - 1);
  });

  it("the night of a day goes over to the next morning even when that day is off", () => {
    const hours = "Mo 18:00-02:00; Tu off";

    expect(isOutsideOpeningHours(hours, on("Tu"), "01:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Tu"), "03:00")).toBe(true);
  });

  it("an empty interval has no meaning, so it never warns", () => {
    expect(closedMinutes("Mo-Su 09:00-09:00", "Mo")).toEqual([]);
  });

  it("Sunday night goes over to Monday morning, the week wraps", () => {
    expect(isOutsideOpeningHours("Su 20:00-03:00", on("Mo"), "01:00")).toBe(
      false
    );
    expect(isOutsideOpeningHours("Su 20:00-03:00", on("Mo"), "04:00")).toBe(
      true
    );
  });

  it("the night only goes over from the days that are open", () => {
    const hours = "Fr-Sa 20:00-03:00";

    expect(isOutsideOpeningHours(hours, on("Sa"), "01:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Su"), "01:00")).toBe(false);
    expect(isOutsideOpeningHours(hours, on("Fr"), "01:00")).toBe(true);
    expect(isOutsideOpeningHours(hours, on("Mo"), "01:00")).toBe(true);
  });

  it("an interval that ends at midnight ends at 24:00, with no change to the next day", () => {
    expect(isOutsideOpeningHours("Mo 18:00-24:00", on("Mo"), "23:59")).toBe(
      false
    );
    expect(isOutsideOpeningHours("Mo 18:00-24:00", on("Tu"), "00:00")).toBe(
      true
    );
  });
});

describe("isOutsideOpeningHours: the function stays a function", () => {
  it("does not change the date it receives", () => {
    const date = on("Mo");
    const before = date.getTime();

    isOutsideOpeningHours("Mo-Su 09:00-18:00", date, "20:00");

    expect(date.getTime()).toBe(before);
  });

  it("gives the same answer for the same input, in any order", () => {
    const calls = [
      ["Mo-Fr 09:00-18:00", "Sa", "10:00"],
      ["Mo-Fr 09:00-18:00", "Mo", "10:00"],
      ["Mo-Fr 09:00-18:00", "Sa", "10:00"],
    ] as const;
    const answers = calls.map(([h, d, t]) =>
      isOutsideOpeningHours(h, on(d), t)
    );

    expect(answers).toEqual([true, false, true]);
  });

  it("an invalid date never warns and never throws", () => {
    expect(
      isOutsideOpeningHours("Mo-Su 09:00-18:00", new Date("nope"), "20:00")
    ).toBe(false);
  });
});

// Real values of the `opening_hours` of the places of Porto, Paris and Berlin that the check does not
// understand yet (review of #181: they must not look like "open"). When the check learns one of
// them, that line moves to the tests above on purpose.
const NOT_UNDERSTOOD_YET = [
  "Mo-Fr 09:00-17:00; Jan 01 off; Dec 25 off",
  "Oct-Mar: Mo-Su 08:00-19:00; Apr-Sep: Mo-Su 08:00-21:00",
  "Apr-Sep Mo-Su 07:00-20:00; Oct-Mar Mo-Su 07:00-18:00",
  "Mo-Sa 12:30-15:30,19:30-23:30; Su,PH off",
  "Mo-Tu, Th-Fr 09:00-16:00; Sa-Su 09:00-17:00",
  "Mo-Th, Su 10:00-23:00; Fr-Sa 10:00-0:00",
  "Su-Th 19:00-02:00, Fr,Sa 19:00-04:00",
  "Mo-Su 10:00+",
  "sunrise-sunset",
];

describe("openingStatus: inside, outside or unknown", () => {
  it("is inside when the place is open at the visit time (AC2)", () => {
    expect(openingStatus("Mo-Su 09:00-18:00", on("Mo"), "10:00")).toBe(
      "inside"
    );
  });

  it("is outside when the place is closed at the visit time (AC1)", () => {
    expect(openingStatus("Mo-Su 09:00-18:00", on("Mo"), "20:00")).toBe(
      "outside"
    );
  });

  it("uses the weekday of the visit (AC5)", () => {
    const hours = "Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off";

    expect(
      WEEKDAYS.map((day) => openingStatus(hours, on(day), "16:00"))
    ).toEqual([
      "inside",
      "inside",
      "inside",
      "inside",
      "inside",
      "outside",
      "outside",
    ]);
  });

  it("is unknown when the place has no opening hours (AC3)", () => {
    for (const hours of [null, undefined, "", "   "]) {
      expect(openingStatus(hours, on("Mo"), "10:00")).toBe("unknown");
    }
  });

  it.each(NOT_UNDERSTOOD_YET)(
    "is unknown, not inside, when the hours are there but not understood: %s",
    (hours) => {
      for (const time of ["03:00", "12:00", "23:30"]) {
        expect(openingStatus(hours, on("Mo"), time)).toBe("unknown");
      }
    }
  );

  it("one rule that is not understood makes the whole text unknown", () => {
    expect(
      openingStatus(
        "Mo-Fr 09:00-12:00; Jul-Aug Mo-Fr 09:00-20:00",
        on("Mo"),
        "19:00"
      )
    ).toBe("unknown");
  });

  it("a rule for public holidays is still ignored, the rest decides", () => {
    expect(openingStatus("Tu-Su 10:00-17:30; PH off", on("Mo"), "12:00")).toBe(
      "outside"
    );
    expect(openingStatus("Tu-Su 10:00-17:30; PH off", on("We"), "12:00")).toBe(
      "inside"
    );
  });

  it("is unknown when the time or the date cannot be read", () => {
    expect(openingStatus("Mo-Su 09:00-18:00", on("Mo"), "9:00")).toBe(
      "unknown"
    );
    expect(openingStatus("Mo-Su 09:00-18:00", on("Mo"), "")).toBe("unknown");
    expect(openingStatus("Mo-Su 09:00-18:00", new Date("nope"), "10:00")).toBe(
      "unknown"
    );
  });

  it("days written wrongly are unknown, they are not read as a shorter range", () => {
    // "Mo-Fr-Su" is not OSM. Read as Mo-Fr, Sunday would get the wrong rule and a false warning.
    for (const hours of [
      "Mo-Fr-Su 09:00-18:00",
      "Mo-Fr,Sa-Su-Mo 09:00-18:00",
    ]) {
      expect(openingStatus(hours, on("Su"), "10:00")).toBe("unknown");
    }
  });

  it("24/7 is always inside", () => {
    expect(
      ALL_TIMES.every((t) => openingStatus("24/7", on("Su"), t) === "inside")
    ).toBe(true);
  });

  it("isOutsideOpeningHours is true only when the status is outside, for every minute of a week", () => {
    for (const hours of [
      "Mo-Fr 09:00-18:00",
      "Mo-Su 18:00-02:00",
      ...NOT_UNDERSTOOD_YET,
      null,
    ]) {
      for (const day of WEEKDAYS) {
        for (const time of ALL_TIMES.filter((_, i) => i % 7 === 0)) {
          expect(isOutsideOpeningHours(hours, on(day), time)).toBe(
            openingStatus(hours, on(day), time) === "outside"
          );
        }
      }
    }
  });
});
