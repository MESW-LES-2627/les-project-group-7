import { describe, it, expect } from "vitest";
import { openingHoursGroups, openingHoursRows } from "./opening-hours-rows";

describe("openingHoursRows: the opening hours of a place, one row per rule (#187)", () => {
  it("has no row when the hours are not known", () => {
    for (const hours of [null, undefined, "", "   "]) {
      expect(openingHoursRows(hours)).toEqual([]);
    }
  });

  it("splits the rules and names the days", () => {
    expect(
      openingHoursRows("Mo-Fr 09:00-18:00; Sa 10:00-14:00,15:00-19:00; Su off")
    ).toEqual([
      { when: "Monday–Friday", hours: ["09:00–18:00"] },
      { when: "Saturday", hours: ["10:00–14:00", "15:00–19:00"] },
      { when: "Sunday", hours: ["Closed"] },
    ]);
  });

  it("says every day for the hours of a whole week", () => {
    expect(openingHoursRows("24/7")).toEqual([
      { when: "Every day", hours: ["Open 24 hours"] },
    ]);
    expect(openingHoursRows("09:00-20:00")).toEqual([
      { when: "Every day", hours: ["09:00–20:00"] },
    ]);
  });

  it("names the months of a season, with or without a colon", () => {
    expect(
      openingHoursRows(
        "Nov-Mar: Mo-Su 09:00-12:30,14:00-17:30; Apr-Oct Mo-Su 09:00-18:30"
      )
    ).toEqual([
      {
        when: "Every day, November to March",
        hours: ["09:00–12:30", "14:00–17:30"],
      },
      { when: "Every day, April to October", hours: ["09:00–18:30"] },
    ]);
  });

  it("names a date and public holidays", () => {
    expect(openingHoursRows("Dec 25 off; Jan 1 off; PH off")).toEqual([
      { when: "25 December", hours: ["Closed"] },
      { when: "1 January", hours: ["Closed"] },
      { when: "Public holidays", hours: ["Closed"] },
    ]);
    expect(openingHoursRows("Su,PH 10:00-14:00")).toEqual([
      { when: "Sunday, public holidays", hours: ["10:00–14:00"] },
    ]);
  });

  it("keeps a rule it does not understand as it is, so nothing is lost", () => {
    expect(openingHoursRows("Mo-Fr 09:00-18:00; sunrise-sunset")).toEqual([
      { when: "Monday–Friday", hours: ["09:00–18:00"] },
      { when: "", hours: ["sunrise-sunset"] },
    ]);
  });

  it("reads days written with a space after the comma", () => {
    expect(
      openingHoursRows("Mo-Th, Su 10:00-23:00; Fr, Sa 10:00-02:00")
    ).toEqual([
      { when: "Monday–Thursday, Sunday", hours: ["10:00–23:00"] },
      { when: "Friday, Saturday", hours: ["10:00–02:00"] },
    ]);
  });

  it("reads an open end as from that time", () => {
    expect(openingHoursRows("Mo-Fr 10:00+; 18:00+")).toEqual([
      { when: "Monday–Friday", hours: ["From 10:00"] },
      { when: "Every day", hours: ["From 18:00"] },
    ]);
  });

  it("says every day for Monday to Sunday", () => {
    expect(openingHoursRows("Mo-Su 09:00-20:00; Su-Sa 10:00-12:00")).toEqual([
      { when: "Every day", hours: ["09:00–20:00"] },
      { when: "Sunday–Saturday", hours: ["10:00–12:00"] },
    ]);
  });

  it("names a range between two dates", () => {
    expect(openingHoursRows("Oct 28-Feb 28 Mo-Su 09:30-17:00")).toEqual([
      { when: "Every day, 28 October to 28 February", hours: ["09:30–17:00"] },
    ]);
    expect(openingHoursRows("Mar 1-Oct 27: Sa,Su 10:00-19:00")).toEqual([
      {
        when: "Saturday, Sunday, 1 March to 27 October",
        hours: ["10:00–19:00"],
      },
    ]);
  });
});

describe("openingHoursRows: the edge cases of the real data (#187)", () => {
  it("reads rules joined with a comma, like Musée de la Vie Romantique", () => {
    expect(openingHoursRows("Tu-Su 10:00-18:00, Mo off")).toEqual([
      { when: "Tuesday–Sunday", hours: ["10:00–18:00"] },
      { when: "Monday", hours: ["Closed"] },
    ]);
  });

  it("puts the times of the same days in one row when a comma joins them", () => {
    expect(openingHoursRows("Mo-Su 12:30-15:30, Mo-Su 19:00-22:30")).toEqual([
      { when: "Every day", hours: ["12:30–15:30", "19:00–22:30"] },
    ]);
  });

  it("does not split a list of days or of times at its commas", () => {
    expect(openingHoursRows("Mo,We 09:00-12:00, 14:00-18:00")).toEqual([
      { when: "Monday, Wednesday", hours: ["09:00–12:00", "14:00–18:00"] },
    ]);
  });

  it("reads a season with no space after the colon, like Square Santiago du Chili", () => {
    expect(
      openingHoursRows(
        "May-Aug: Mo-Fr 08:00-20:30; May-Aug:Sa,Su,PH 09:00-20:30"
      )
    ).toEqual([
      { when: "Monday–Friday, May to August", hours: ["08:00–20:30"] },
      {
        when: "Saturday, Sunday, public holidays, May to August",
        hours: ["09:00–20:30"],
      },
    ]);
  });

  it("reads a closing time with a plus as or later, like Bem-me-Quer", () => {
    expect(openingHoursRows("Mo-Sa 06:00-20:00; Su 07:00-18:00+")).toEqual([
      { when: "Monday–Saturday", hours: ["06:00–20:00"] },
      { when: "Sunday", hours: ["07:00–18:00 or later"] },
    ]);
  });

  it("names a weekday of the month, like the Élysée Palace Garden", () => {
    expect(
      openingHoursRows("Su[1] 11:00-19:00; Sa[-1] off; Mo[3] 10:00-12:00")
    ).toEqual([
      { when: "First Sunday of the month", hours: ["11:00–19:00"] },
      { when: "Last Saturday of the month", hours: ["Closed"] },
      { when: "Third Monday of the month", hours: ["10:00–12:00"] },
    ]);
  });

  it("shows a comment in quotes as a note, like the Carnavalet Museum", () => {
    expect(
      openingHoursRows('Tu-Su 10:00-18:00 "Final admission 17:15"')
    ).toEqual([
      {
        when: "Tuesday–Sunday",
        hours: ["10:00–18:00"],
        note: "Final admission 17:15",
      },
    ]);
    expect(
      openingHoursRows('Su,PH 08:00-12:45,16:00-19:30 open "Sonnez"')
    ).toEqual([
      {
        when: "Sunday, public holidays",
        hours: ["08:00–12:45", "16:00–19:30"],
        note: "Sonnez",
      },
    ]);
  });

  it("keeps a comment alone as it is, without the quotes, like the Federal Chancellery", () => {
    expect(openingHoursRows('"Nur mit Termin"')).toEqual([
      { when: "", hours: ["Nur mit Termin"] },
    ]);
  });

  it("names Easter Sunday like a date, like the Tesouro-Museu da Sé", () => {
    expect(openingHoursRows("easter off; Dec 25 off")).toEqual([
      { when: "Easter Sunday", hours: ["Closed"] },
      { when: "25 December", hours: ["Closed"] },
    ]);
  });

  it("reads dates that are a weekday of a month, like Square Philippe Farine", () => {
    expect(
      openingHoursRows(
        "Oct 01-Oct Su[-1] 09:30-18:30; Oct Su[-1]-Feb 29 09:30-17:00; Sep 09:30-19:30"
      )
    ).toEqual([
      {
        when: "Every day, 1 October to the last Sunday of October",
        hours: ["09:30–18:30"],
      },
      {
        when: "Every day, the last Sunday of October to 29 February",
        hours: ["09:30–17:00"],
      },
      { when: "Every day, September", hours: ["09:30–19:30"] },
    ]);
  });

  it("still keeps the sun and a fallback as listed", () => {
    expect(openingHoursRows("sunrise-sunset")).toEqual([
      { when: "", hours: ["sunrise-sunset"] },
    ]);
    expect(openingHoursRows("Sep 09:30-19:30 || Sa,Su,PH 09:00-09:30")).toEqual(
      [{ when: "", hours: ["Sep 09:30-19:30 || Sa,Su,PH 09:00-09:30"] }]
    );
  });
});

describe("openingHoursGroups: a season with several rows under its own heading (#187)", () => {
  it("puts the days of a season under it, like Square Santiago du Chili", () => {
    expect(
      openingHoursGroups(
        "May-Aug: Mo-Fr 08:00-20:30; May-Aug:Sa,Su,PH 09:00-20:30;Sep: Mo-Fr 08:00-19:30; Sep:Sa,Su,PH 09:00-19:30"
      )
    ).toEqual([
      {
        heading: "May to August",
        rows: [
          { when: "Monday–Friday", hours: ["08:00–20:30"] },
          { when: "Saturday, Sunday, public holidays", hours: ["09:00–20:30"] },
        ],
      },
      {
        heading: "September",
        rows: [
          { when: "Monday–Friday", hours: ["08:00–19:30"] },
          { when: "Saturday, Sunday, public holidays", hours: ["09:00–19:30"] },
        ],
      },
    ]);
  });

  it("leaves a season with a single row as a row, like Palácio da Bolsa", () => {
    expect(
      openingHoursGroups(
        "Nov-Mar: Mo-Su 09:00-12:30,14:00-17:30; Apr-Oct: Mo-Su 09:00-18:30; Dec 25 off; Jan 1 off"
      )
    ).toEqual([
      {
        heading: null,
        rows: [
          {
            when: "Every day, November to March",
            hours: ["09:00–12:30", "14:00–17:30"],
          },
          { when: "Every day, April to October", hours: ["09:00–18:30"] },
          { when: "25 December", hours: ["Closed"] },
          { when: "1 January", hours: ["Closed"] },
        ],
      },
    ]);
  });

  it("gathers the rows of a season even when other rules come between them", () => {
    expect(
      openingHoursGroups(
        "Apr-Sep Mo-Fr 09:00-19:00; Dec 25 off; Apr-Sep Sa,Su 10:00-18:00"
      )
    ).toEqual([
      {
        heading: "April to September",
        rows: [
          { when: "Monday–Friday", hours: ["09:00–19:00"] },
          { when: "Saturday, Sunday", hours: ["10:00–18:00"] },
        ],
      },
      { heading: null, rows: [{ when: "25 December", hours: ["Closed"] }] },
    ]);
  });

  it("leaves out the rules that are not read, which the page lists apart", () => {
    expect(openingHoursGroups('"Nur mit Termin"')).toEqual([]);
  });
});
