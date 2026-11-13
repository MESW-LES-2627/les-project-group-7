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
