/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RegisterPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => cleanup());

describe("Register page (#187, AC4)", () => {
  it("links to the login page, as the login page links here", () => {
    render(<RegisterPage />);

    expect(screen.getByText(/Already have an account\?/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Log in" }).getAttribute("href")
    ).toBe("/login");
  });
});
