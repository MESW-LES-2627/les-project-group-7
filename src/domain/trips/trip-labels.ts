/** "Day 1 — Tue 1 Dec 2026". The date is read as UTC so no time zone can move it to another day. */
export function formatDayLabel(dayNumber: number, dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Day ${dayNumber} — ${date.replace(",", "")}`;
}

/** "1 Dec 2026 – 3 Dec 2026" or "1 Dec 2026" if single day. Date is read as UTC. */
export function formatTripDateRange(
  startDateOnly: string,
  endDateOnly: string
): string {
  const format = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  if (startDateOnly === endDateOnly) {
    return format(startDateOnly);
  }
  return `${format(startDateOnly)} – ${format(endDateOnly)}`;
}

/** "1 day" or "3 days". */
export function formatTripDuration(daysCount: number): string {
  return daysCount === 1 ? "1 day" : `${daysCount} days`;
}
