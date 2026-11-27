import { describe, it, expect } from "vitest";
import { pageView } from "./pages";

describe("pageView: the page of a list from the address (#187)", () => {
  it("is the first page when the address has none", () => {
    expect(pageView(25, undefined, 10)).toEqual({
      page: 1,
      totalPages: 3,
      total: 25,
      skip: 0,
      take: 10,
      firstShown: 1,
      lastShown: 10,
    });
  });

  it("gives the places or reviews of the page asked", () => {
    expect(pageView(25, "2", 10)).toMatchObject({
      page: 2,
      skip: 10,
      firstShown: 11,
      lastShown: 20,
    });
  });

  it("ends the last page at the last item", () => {
    expect(pageView(25, "3", 10)).toMatchObject({
      firstShown: 21,
      lastShown: 25,
    });
  });

  it("goes to the nearest real page for a page too big, too small or not a number", () => {
    expect(pageView(25, "9", 10).page).toBe(3);
    for (const page of ["0", "-1", "abc", "1.5", "2e1", ""]) {
      expect(pageView(25, page, 10).page).toBe(1);
    }
  });

  it("reads the first value when the page is given twice", () => {
    expect(pageView(25, ["2", "3"], 10).page).toBe(2);
  });

  it("has one empty page for an empty list", () => {
    expect(pageView(0, "4", 10)).toEqual({
      page: 1,
      totalPages: 1,
      total: 0,
      skip: 0,
      take: 10,
      firstShown: 0,
      lastShown: 0,
    });
  });
});
