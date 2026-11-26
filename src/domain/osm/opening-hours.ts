const DAYS: Record<string, string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};

function formatDays(value: string): string {
  return value
    .split(",")
    .map((part) => {
      const range = /^([A-Za-z]{2})-([A-Za-z]{2})$/.exec(part);

      if (range && DAYS[range[1]] && DAYS[range[2]]) {
        return `${DAYS[range[1]]}–${DAYS[range[2]]}`;
      }

      return DAYS[part] ?? part;
    })
    .join(", ");
}

/**
 * Formats common OSM opening_hours expressions for display.
 * Unrecognized rules are preserved rather than guessed.
 */
export function formatOpeningHours(
  openingHours: string | null | undefined
): string {
  const hours = openingHours?.trim();

  if (!hours) {
    return "Unknown";
  }

  if (hours === "24/7") {
    return "Open 24 hours, every day";
  }

  const rules = hours.split(";").map((rule) => rule.trim());

  return rules
    .map((rule) => {
      const match =
        /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/.exec(
          rule
        );

      if (!match) {
        return rule;
      }

      const days = formatDays(match[1]);
      const schedule = match[2];

      if (schedule === "off" || schedule === "closed") {
        return `${days}: Closed`;
      }

      if (schedule === "24h") {
        return `${days}: Open 24 hours`;
      }

      if (
        /^\d{2}:\d{2}-\d{2}:\d{2}(?:\s*,\s*\d{2}:\d{2}-\d{2}:\d{2})*$/.test(
          schedule
        )
      ) {
        return `${days}: ${schedule.replace(/-/g, "–")}`;
      }

      return rule;
    })
    .join("; ");
}

// The day codes of OSM, Monday first: the same table the display uses.
const DAY_CODES = Object.keys(DAYS);
const MINUTES_PER_DAY = 24 * 60;
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const INTERVAL = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

// One rule: the days (optional, then it is every day) and the schedule, like "Mo-Fr 09:00-18:00",
// "Sa off" or "09:00-18:00".
const RULE = /^(?:([A-Za-z,-]+)\s+)?(\S.*)$/;

type Interval = [start: number, end: number];

function toMinutes(hh: string, mm: string, allow24 = false): number | null {
  const minutes = Number(hh) * 60 + Number(mm);
  const max = allow24 ? MINUTES_PER_DAY : MINUTES_PER_DAY - 1;
  return Number(mm) < 60 && minutes <= max ? minutes : null;
}

/** The days (0 = Monday) of "Mo", "Mo-Fr", "Sa-Mo" or "Mo,We,Fr"; null if not understood. */
function parseDays(selector: string): number[] | null {
  const days: number[] = [];

  for (const part of selector.split(",")) {
    const [from, to = from] = part.trim().split("-");
    const start = DAY_CODES.indexOf(from);
    const end = DAY_CODES.indexOf(to);

    if (start < 0 || end < 0) return null;

    for (let day = start; ; day = (day + 1) % 7) {
      days.push(day);
      if (day === end) break;
    }
  }

  return days;
}

/** "off", "24h" or "09:00-12:00,13:00-18:00"; null if not understood. An end before the start crosses midnight. */
function parseSchedule(schedule: string): Interval[] | null {
  if (schedule === "off" || schedule === "closed") return [];
  if (schedule === "24h") return [[0, MINUTES_PER_DAY]];

  const intervals: Interval[] = [];

  for (const part of schedule.split(",")) {
    const match = INTERVAL.exec(part.trim());

    if (!match) return null;

    const start = toMinutes(match[1], match[2]);
    const end = toMinutes(match[3], match[4], true);

    // An empty interval ("09:00-09:00") has no clear meaning: unknown, so it never warns.
    if (start === null || end === null || start === end) return null;

    intervals.push([start, end > start ? end : end + MINUTES_PER_DAY]);
  }

  return intervals;
}

/** The intervals of each day (0 = Monday), or null when an OSM rule is not understood. */
function parseWeek(openingHours: string): Interval[][] | null {
  const week: Interval[][] = Array.from({ length: 7 }, () => []);

  if (openingHours === "24/7") return week.map(() => [[0, MINUTES_PER_DAY]]);

  let understood = 0;

  for (const rule of openingHours.split(";").map((r) => r.trim())) {
    // PH needs a calendar of holidays; ignoring "PH off" only misses a warning, it never invents one.
    if (rule === "" || /^PH\s+off$/.test(rule)) continue;

    const match = RULE.exec(rule);
    const days = match?.[1]
      ? parseDays(match[1])
      : DAY_CODES.map((_, day) => day);
    const intervals = match && parseSchedule(match[2]);

    if (!days || !intervals) return null;

    for (const day of days) week[day] = intervals;
    understood++;
  }

  return understood > 0 ? week : null;
}

/**
 * Whether a visit is outside the opening hours of a place (US-E6-01, #66). The end of an interval
 * is already closed. Hours that are unknown, or that this function does not understand, never
 * warn: the answer is `false`, it is the stop that says the hours are unknown.
 *
 * @param openingHours the OSM `opening_hours` of the place, `null` when unknown
 * @param date the date of the visit (Day.date, midnight UTC), its weekday decides the rule
 * @param time the visit time "HH:mm"
 */
export function isOutsideOpeningHours(
  openingHours: string | null | undefined,
  date: Date,
  time: string
): boolean {
  const hours = openingHours?.trim();
  const match = TIME_OF_DAY.exec(time);

  if (!hours || !match || Number.isNaN(date.getTime())) return false;

  // shortcut: the text is parsed on every call, fine for the stops of a page; keep the result by
  // text if many stops are checked at once.
  const week = parseWeek(hours);

  if (!week) return false;

  const minute = Number(match[1]) * 60 + Number(match[2]);
  // getUTCDay() counts from Sunday, the days of the week here from Monday.
  const today = (date.getUTCDay() + 6) % 7;
  const yesterday = (today + 6) % 7;

  const openToday = week[today].some(
    ([start, end]) => minute >= start && minute < end
  );
  // The part of last night's interval that is after midnight.
  const openFromYesterday = week[yesterday].some(
    ([, end]) => minute < end - MINUTES_PER_DAY
  );

  return !(openToday || openFromYesterday);
}
