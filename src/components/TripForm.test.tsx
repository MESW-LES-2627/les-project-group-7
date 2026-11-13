import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import TripForm from "./TripForm";

const cities = [{ id: "c1", name: "Porto", country: "Portugal" }];

describe("TripForm", () => {
  it("asks only for a name, a city and the dates, with no min on the dates", () => {
    const html = renderToStaticMarkup(<TripForm cities={cities} />);

    for (const name of ["name", "cityId", "startDate", "endDate"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain("Porto, Portugal");
    expect(html).not.toContain("min=");
    expect(html).not.toContain("budget");
  });

  it("shows the error of each field under it (AC7)", () => {
    const html = renderToStaticMarkup(
      <TripForm
        cities={cities}
        initialErrors={{
          name: "Name is required",
          cityId: "Choose a city",
          startDate: "Start date is required",
          endDate: "End date is required",
        }}
      />
    );

    expect(html).toContain("Name is required");
    expect(html).toContain("Choose a city</p>");
    expect(html).toContain("Start date is required");
    expect(html).toContain("End date is required");
  });

  it("links a field to its error for screen readers", () => {
    const html = renderToStaticMarkup(
      <TripForm cities={cities} initialErrors={{ name: "Name is required" }} />
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="name-error"');
    expect(html).toContain('id="name-error"');
  });
});
