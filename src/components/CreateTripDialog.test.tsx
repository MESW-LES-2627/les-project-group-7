import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import CreateTripDialog from "./CreateTripDialog";

const cities = [{ id: "c1", name: "Porto", country: "Portugal" }];

describe("CreateTripDialog", () => {
  it("shows a button to plan a trip, with the form closed until it is clicked", () => {
    const html = renderToStaticMarkup(
      <CreateTripDialog cities={cities} loggedIn />
    );

    expect(html).toContain("Plan a trip");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("<form");
  });

  it("sends a person who is not logged in to the login page", () => {
    const html = renderToStaticMarkup(
      <CreateTripDialog cities={cities} loggedIn={false} />
    );

    expect(html).toContain('href="/login"');
    expect(html).toContain("Log in to plan a trip");
  });
});
