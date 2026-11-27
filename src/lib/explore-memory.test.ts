/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cameBackByHistory,
  forgetExplore,
  recallExplore,
  rememberExplore,
} from "./explore-memory";

afterEach(() => {
  forgetExplore();
  vi.useRealTimers();
});

describe("explore memory: the home page as it was left (#187)", () => {
  it("is empty at first, like after a refresh or in a new tab", () => {
    expect(recallExplore()).toEqual({});
  });

  it("keeps what was remembered, and a later change only replaces its own part", () => {
    rememberExplore({ center: [48.86, 2.35], zoom: 13 });
    rememberExplore({ cityId: "city-paris", currentPage: 3 });
    rememberExplore({ zoom: 15, scrollY: 1373 });

    expect(recallExplore()).toEqual({
      center: [48.86, 2.35],
      zoom: 15,
      cityId: "city-paris",
      currentPage: 3,
      scrollY: 1373,
    });
  });

  it("gives a copy, so the page cannot change the memory by accident", () => {
    rememberExplore({ center: [48.86, 2.35] });

    recallExplore().center![0] = 0;

    expect(recallExplore().center).toEqual([48.86, 2.35]);
  });
});

describe("cameBackByHistory: Back or Forward, not a link (#187)", () => {
  it("is false when the page was reached by a link", () => {
    expect(cameBackByHistory()).toBe(false);
  });

  it("is true right after Back or Forward, also when asked twice (React starts a page twice in development)", () => {
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(cameBackByHistory()).toBe(true);
    expect(cameBackByHistory()).toBe(true);
  });

  it("forgets an old Back, so a later link does not count as one", () => {
    vi.useFakeTimers();
    window.dispatchEvent(new PopStateEvent("popstate"));

    vi.advanceTimersByTime(5000);

    expect(cameBackByHistory()).toBe(false);
  });
});
