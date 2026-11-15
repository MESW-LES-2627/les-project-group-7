import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import DeleteTripDialog from "./DeleteTripDialog";

describe("DeleteTripDialog", () => {
  it("shows the delete button, with the confirmation closed until it is clicked", () => {
    const html = renderToStaticMarkup(
      <DeleteTripDialog tripId="t1" tripName="Weekend in Porto" />
    );

    expect(html).toContain("Delete trip");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Keep trip");
  });
});
