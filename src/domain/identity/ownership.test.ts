import { describe, it, expect } from "vitest";
import { canModify } from "./ownership";

describe("canModify", () => {
  it("lets a user change what they own", () => {
    expect(canModify("user-1", "user-1")).toBe(true);
  });

  it("refuses to let a user change what another user owns", () => {
    expect(canModify("user-1", "user-2")).toBe(false);
  });

  it("refuses when nobody is logged in", () => {
    expect(canModify(null, "user-1")).toBe(false);
    expect(canModify(undefined, "user-1")).toBe(false);
    expect(canModify("", "user-1")).toBe(false);
  });

  it("refuses when the owner is unknown, even if nobody is logged in", () => {
    expect(canModify("user-1", "")).toBe(false);
    expect(canModify(null, "")).toBe(false);
    expect(canModify("", "")).toBe(false);
  });

  it("compares the ids exactly, with no trimming and no case folding", () => {
    expect(canModify("User-1", "user-1")).toBe(false);
    expect(canModify("user-1 ", "user-1")).toBe(false);
  });
});
