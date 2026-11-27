/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LogoutButton from "./LogoutButton";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

describe("LogoutButton (#187)", () => {
  it("says it is logging out and cannot be pressed again while the request runs (AC1)", async () => {
    let answer: (value: { ok: boolean }) => void = () => {};
    const fetchMock = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    const busy = screen.getByRole("button", { name: "Logging out…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    await user.click(busy);
    expect(fetchMock).toHaveBeenCalledOnce();

    answer({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("says the log out failed and can be tried again", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 })
    );
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(
      await screen.findByRole("button", { name: "Log out failed, retry" })
    ).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
