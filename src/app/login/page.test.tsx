/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Login page (#187)", () => {
  it("marks both fields as wrong and links them to the message when the login fails (AC3, AC5)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("Username or e-mail"), "ana");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.id).toBe("login-error");
    for (const label of ["Username or e-mail", "Password"]) {
      const field = screen.getByLabelText(label);
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")).toBe("login-error");
    }
  });

  it("does not mark the fields before anything went wrong", () => {
    render(<LoginPage />);

    expect(
      screen.getByLabelText("Password").getAttribute("aria-invalid")
    ).toBeNull();
  });

  it("links to the registration page", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("link", { name: "Register" }).getAttribute("href")
    ).toBe("/register");
  });
});
