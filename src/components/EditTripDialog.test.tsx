import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import EditTripDialog, { RemovalList } from "./EditTripDialog";

describe("EditTripDialog", () => {
  it("shows the edit button, with the form closed until it is clicked", () => {
    const html = renderToStaticMarkup(
      <EditTripDialog
        tripId="t1"
        name="Porto"
        startDate="2030-05-10"
        endDate="2030-05-12"
      />
    );

    expect(html).toContain("Edit trip");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Save changes");
  });
});

describe("RemovalList", () => {
  it("lists each day with the number of stops it loses", () => {
    const html = renderToStaticMarkup(
      <RemovalList
        days={[
          { dayNumber: 3, date: "2030-05-12", stops: 2 },
          { dayNumber: 4, date: "2030-05-13", stops: 1 },
        ]}
      />
    );

    expect(html).toContain("Day 3 — Sun 12 May 2030");
    expect(html).toContain("2 stops");
    expect(html).toContain("1 stop<");
  });
});
