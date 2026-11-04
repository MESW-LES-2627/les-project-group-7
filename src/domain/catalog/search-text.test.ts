import { describe, it, expect } from "vitest";
import { normalizeSearchText } from "./search-text";

describe("normalizeSearchText", () => {
  it("removes case and accents", () => {
    expect(normalizeSearchText("São PAULO")).toBe("sao paulo");
  });

  it("reads ß as ss, also in capitals", () => {
    expect(normalizeSearchText("Straße")).toBe("strasse");
    expect(normalizeSearchText("STRAẞE")).toBe("strasse");
  });

  it("removes the spaces around the text", () => {
    expect(normalizeSearchText("  Porto ")).toBe("porto");
  });
});
