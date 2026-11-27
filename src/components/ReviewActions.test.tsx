/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewActions from "./ReviewActions";
import { NETWORK_ERROR, TEXT_MISSING } from "@/domain/reviews/review-form";

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const mockReview = {
  id: "review-123",
  rating: 4,
  priceLevel: "€",
  text: "Very nice place.",
};

beforeEach(() => {
  refresh.mockReset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ReviewActions (Task #41)", () => {
  it("renders Edit and Delete buttons", () => {
    render(<ReviewActions review={mockReview} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();

    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("opens the edit dialog with the current review values", async () => {
    const user = userEvent.setup();

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByRole("heading", { name: "Edit review" })).toBeTruthy();

    expect(
      (screen.getByLabelText("Review text") as HTMLTextAreaElement).value
    ).toBe("Very nice place.");

    expect(
      screen.getByRole("button", { name: /4 ★/ }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("sends PATCH with the updated rating, price and text", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });

    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: /5 ★/ }));
    await user.click(screen.getByRole("button", { name: "€€" }));

    const textarea = screen.getByLabelText("Review text");

    await user.clear(textarea);
    await user.type(textarea, "Amazing experience!");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe("/api/reviews/review-123");
    expect(options.method).toBe("PATCH");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
    });

    expect(JSON.parse(options.body)).toEqual({
      rating: 5,
      priceLevel: "€€",
      text: "Amazing experience!",
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
  });

  it("cancels editing without sending a request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("requires confirmation before deleting", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.getByRole("heading", { name: "Delete review?" })
    ).toBeTruthy();

    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends DELETE after confirmation and refreshes the page", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });

    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Delete review" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/reviews/review-123", {
        method: "DELETE",
      });
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
  });

  it("shows an error when PATCH fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Update failed" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Update failed"
    );

    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows an error when DELETE fails", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Delete failed" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await user.click(screen.getByRole("button", { name: "Delete review" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Delete failed"
    );

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("ReviewActions: clear feedback (#187)", () => {
  it("keeps Save ready on an empty text and says under the text what is missing, without sending (AC3)", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const textbox = screen.getByRole("textbox");
    await user.clear(textbox);
    await user.type(textbox, "   ");
    const save = screen.getByRole("button", { name: "Save changes" });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    await user.click(save);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(TEXT_MISSING).id).toBe(
      "review-text-review-123-error"
    );
    expect(textbox.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(textbox);
  });

  it("takes the message away when the text is given again and saved", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.type(screen.getByRole("textbox"), "Better now.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.queryByText(TEXT_MISSING)).toBeNull();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("says the server could not be reached, not the words of the browser, when saving does not get through", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );
    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect((await screen.findByRole("alert")).textContent).toBe(NETWORK_ERROR);
  });

  it("gives a plain message when the server answers an error without one", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );
    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete review" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not delete the review, try again"
    );
  });

  it("says it is saving and deleting with the same … as the rest of the app (AC1, AC4)", async () => {
    const user = userEvent.setup();
    let answer: (value: { ok: boolean }) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (answer = resolve)))
    );
    render(<ReviewActions review={mockReview} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy();
    answer({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete review" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeTruthy();
    answer({ ok: true });
  });
});
