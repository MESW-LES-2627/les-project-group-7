/**
 * The opening hours of a place as rows to read, for the place page (#187): one row per OSM rule, with
 * the days or the season ("when") and the hours. A rule that is not understood is kept as it is, so no
 * information is lost; the check of a visit (opening-hours.ts) is separate.
 */

export interface OpeningHoursRow {
  /** The days, the season or the date, like "Monday–Friday"; empty for a rule kept as it is. */
  when: string;
  /** One entry per opening time of the day, shown one above the other, or "Closed", or the rule as is. */
  hours: string[];
  /** A comment of OpenStreetMap in quotes, like "Final admission 17:15", shown under the hours. */
  note?: string;
}

/** A row and, when it belongs to a season or a range of dates, that period and its days apart. */
interface ReadRow extends OpeningHoursRow {
  period?: string;
  days?: string;
}

/** The rows of one season under its heading, or rows with no heading (heading null). */
export interface OpeningHoursGroup {
  heading: string | null;
  rows: OpeningHoursRow[];
}

const DAYS: Record<string, string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
  PH: "public holidays",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_CODE = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
// The end of a selector: a colon (with or without a space after it, "May-Aug:Sa") or a space
const SELECTOR_END = "(?::\\s*|\\s+)";
const SEASON = new RegExp(
  `^(${MONTH_CODE}(?:-${MONTH_CODE})?(?:,${MONTH_CODE}(?:-${MONTH_CODE})?)*)${SELECTOR_END}(.+)$`
);
// A day of a month: "Oct 28", "May15", or a weekday of the month, "Oct Su[-1]" (the last Sunday of
// October). The number is not followed by a digit or ":" and a digit (a time), so "Sep 09:30-19:30" is September, not 9 September.
const WEEKDAY_CODE = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
const DATE_POINT = `${MONTH_CODE}(?:\\s?\\d{1,2}(?!\\d|:\\d)|\\s${WEEKDAY_CODE}\\[(?:-1|[1-5])\\])`;
// Dates and ranges of dates: "Dec 25", "Oct 28-Feb 28", "Mar 1-May15", "Oct 01-Oct Su[-1]", "Jan 01,May 01"
const DATE_ITEM = `${DATE_POINT}(?:-(?:${DATE_POINT}|\\d{1,2}(?!\\d|:\\d)))?`;
const DATE_ITEM_PARTS = new RegExp(`^(${DATE_POINT})(?:-(.+))?$`);
const DATES = new RegExp(
  `^(${DATE_ITEM}(?:,${DATE_ITEM})*)${SELECTOR_END}(.+)$`
);
// "18:00+" at the end: open until 18:00 or later
const INTERVAL = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})(\+?)$/;
// A comma that starts another rule ("Tu-Su 10:00-18:00, Mo off"), not one inside a list of days or times
const NEXT_RULE = new RegExp(
  `(?<=\\d|off|closed|\\+|")\\s*,\\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|${MONTH_CODE.slice(3, -1)})\\b)`
);
const ORDINALS: Record<string, string> = {
  "1": "first",
  "2": "second",
  "3": "third",
  "4": "fourth",
  "5": "fifth",
  "-1": "last",
};

const monthName = (code: string) =>
  MONTHS.find((name) => name.startsWith(code)) ?? code;

const capitalized = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** "Mo-Fr,Su,PH" as "Monday–Friday, Sunday, public holidays"; null if not understood. */
function formatDays(selector: string): string | null {
  if (selector === "Mo-Su") return "Every day";

  const parts = selector.split(",").map((part) => {
    // "Su[1]": the first Sunday of the month, "Su[-1]" the last one
    const nth = /^(Mo|Tu|We|Th|Fr|Sa|Su)\[(-1|[1-5])\]$/.exec(part);
    if (nth) return `${ORDINALS[nth[2]]} ${DAYS[nth[1]]} of the month`;

    const [from, to, ...rest] = part.split("-");
    if (rest.length > 0 || !DAYS[from] || (to !== undefined && !DAYS[to])) {
      return null;
    }
    return to === undefined ? DAYS[from] : `${DAYS[from]}–${DAYS[to]}`;
  });

  return parts.includes(null) ? null : capitalized(parts.join(", "));
}

/** "off", "24h" or "09:00-12:30,14:00-17:30" (one entry per time); null if not understood. */
function formatSchedule(schedule: string): string[] | null {
  if (schedule === "off" || schedule === "closed") return ["Closed"];
  if (schedule === "24h" || schedule === "00:00-24:00")
    return ["Open 24 hours"];

  // "10:00+" is an open end: open from that time
  const from = /^(\d{1,2}:\d{2})\+$/.exec(schedule);
  if (from) return [`From ${from[1]}`];

  const intervals = schedule.split(",").map((part) => {
    const match = INTERVAL.exec(part.trim());
    if (!match) return null;
    return `${match[1]}–${match[2]}${match[3] ? " or later" : ""}`;
  });

  return intervals.every((interval) => interval !== null) ? intervals : null;
}

/** "Nov-Mar" as "November to March", "Jul,Aug" as "July, August". */
function formatMonths(selector: string): string {
  return selector
    .split(",")
    .map((part) => {
      const [from, to] = part.split("-");
      return to ? `${monthName(from)} to ${monthName(to)}` : monthName(from);
    })
    .join(", ");
}

/** "Oct 28" as "28 October", "Oct Su[-1]" as "the last Sunday of October", "15" as "15 <month>". */
function formatDatePoint(point: string, month?: string): string {
  const nth = /^([A-Za-z]{3})\s(Mo|Tu|We|Th|Fr|Sa|Su)\[(-1|[1-5])\]$/.exec(
    point
  );
  if (nth) {
    return `the ${ORDINALS[nth[3]]} ${DAYS[nth[2]]} of ${monthName(nth[1])}`;
  }
  const day = /^(?:([A-Za-z]{3})\s?)?(\d{1,2})$/.exec(point)!;
  return `${Number(day[2])} ${monthName(day[1] ?? month ?? "")}`;
}

/** "Oct 28-Feb 28,Dec 25" as "28 October to 28 February, 25 December"; also says if all are single days. */
function formatDates(selector: string): { label: string; singleDays: boolean } {
  let singleDays = true;
  const label = selector
    .split(",")
    .map((item) => {
      const [, from, to] = DATE_ITEM_PARTS.exec(item)!;
      const start = formatDatePoint(from);
      if (to === undefined) return start;

      singleDays = false;
      return `${start} to ${formatDatePoint(to, from.slice(0, 3))}`;
    })
    .join(", ");

  return { label, singleDays };
}

/** The days and the hours of a rule, without a season or dates; null when not understood. */
function formatWeek(text: string): OpeningHoursRow | null {
  // "Fr, Sa 10:00-02:00" is written like "Fr,Sa 10:00-02:00"
  const rest = text.replace(/,\s+(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, ",");

  const everyDay = formatSchedule(rest);
  if (everyDay) return { when: "Every day", hours: everyDay };

  const split = /^(\S+)\s+(.+)$/.exec(rest);
  const when = split && formatDays(split[1]);
  const hours = split && formatSchedule(split[2]);
  return when && hours ? { when, hours } : null;
}

/** One rule, or null when a part of it is not understood. */
function formatRule(rule: string): ReadRow | null {
  // A comment in quotes at the end becomes a note under the hours ("open" before it says nothing more)
  const comment = /^(.*?)\s*"([^"]*)"$/.exec(rule);
  if (comment) {
    const body = comment[1].replace(/\s+open$/, "");
    const row: ReadRow | null = body ? formatRule(body) : null;
    return row && { ...row, note: comment[2] };
  }

  // Easter Sunday ("easter"), a different date every year, said like a date
  const easter = /^easter\s+(.+)$/.exec(rule);
  if (easter) {
    const hours = formatSchedule(easter[1]);
    return hours && { when: "Easter Sunday", hours };
  }

  const dates = DATES.exec(rule);
  const datesWeek = dates && formatWeek(dates[2]);
  if (dates && datesWeek) {
    const { label, singleDays } = formatDates(dates[1]);

    // "25 December: Closed"; a range of dates also says which days of the week
    if (datesWeek.when === "Every day" && singleDays) {
      return { when: capitalized(label), hours: datesWeek.hours };
    }
    return withPeriod(datesWeek, label);
  }

  const season = SEASON.exec(rule);
  const week = formatWeek(season ? season[2] : rule);
  if (!week) return null;

  return season ? withPeriod(week, formatMonths(season[1])) : week;
}

/** The days of a rule in a season or a range of dates: "Monday–Friday, May to August". */
function withPeriod(week: OpeningHoursRow, period: string): ReadRow {
  return { ...week, when: `${week.when}, ${period}`, period, days: week.when };
}

/** The rows of the opening hours, in the order of OpenStreetMap. */
export function openingHoursRows(
  openingHours: string | null | undefined
): OpeningHoursRow[] {
  return readRows(openingHours).map(asRow);
}

/**
 * The rows read, with each season of several rows under its own heading ("May to August", then its
 * days); a season with a single row stays a row ("Every day, April to October"). The rules that are not
 * read are left out: the page lists them apart, as they are.
 */
export function openingHoursGroups(
  openingHours: string | null | undefined
): OpeningHoursGroup[] {
  const rows = readRows(openingHours).filter((row) => row.when);
  const perPeriod = new Map<string, number>();
  for (const row of rows) {
    if (row.period)
      perPeriod.set(row.period, (perPeriod.get(row.period) ?? 0) + 1);
  }

  const groups: OpeningHoursGroup[] = [];
  const ofPeriod = new Map<string, OpeningHoursGroup>();
  for (const row of rows) {
    if (row.period && row.days && (perPeriod.get(row.period) ?? 0) > 1) {
      let group = ofPeriod.get(row.period);
      if (!group) {
        group = { heading: capitalized(row.period), rows: [] };
        ofPeriod.set(row.period, group);
        groups.push(group);
      }
      group.rows.push(asRow({ ...row, when: row.days }));
      continue;
    }

    const last = groups[groups.length - 1];
    if (last && last.heading === null) last.rows.push(asRow(row));
    else groups.push({ heading: null, rows: [asRow(row)] });
  }

  return groups;
}

/** A row without the period and days kept apart for the groups. */
function asRow({ when, hours, note }: ReadRow): OpeningHoursRow {
  return note === undefined ? { when, hours } : { when, hours, note };
}

function readRows(openingHours: string | null | undefined): ReadRow[] {
  const hours = openingHours?.trim();
  if (!hours) return [];
  if (hours === "24/7") {
    return [{ when: "Every day", hours: ["Open 24 hours"] }];
  }

  return hours
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .flatMap((rule) => joinSameDays(rule.split(NEXT_RULE).map(readRule)));
}

/** A rule read, or kept as it is (a comment alone without its quotes). */
function readRule(rule: string): ReadRow {
  return (
    formatRule(rule) ?? {
      when: "",
      hours: [rule.replace(/^"([^"]*)"$/, "$1")],
    }
  );
}

/** Rules joined by a comma that give the same days are one row with all their times. */
function joinSameDays(rows: ReadRow[]): ReadRow[] {
  return rows.reduce<ReadRow[]>((joined, row) => {
    const last = joined[joined.length - 1];
    if (last && row.when && last.when === row.when && !last.note && !row.note) {
      last.hours = [...last.hours, ...row.hours];
    } else {
      joined.push({ ...row });
    }
    return joined;
  }, []);
}
