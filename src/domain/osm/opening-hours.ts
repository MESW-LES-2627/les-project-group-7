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
