import { describe, it, expect } from "vitest";
import { pickReviewers } from "./reviewers";

const USERS = ["u1", "u2", "u3", "u4", "u5"];

describe("pickReviewers", () => {
  it("gives every review of a place a different user", () => {
    const picked = pickReviewers(5, USERS);
    expect(new Set(picked).size).toBe(5);
  });

  it("takes the users in order when the offset is 0", () => {
    expect(pickReviewers(3, USERS)).toEqual(["u1", "u2", "u3"]);
  });

  it("starts at the offset and wraps around, still with different users", () => {
    expect(pickReviewers(3, USERS, new Set(), 3)).toEqual(["u4", "u5", "u1"]);
    expect(pickReviewers(5, USERS, new Set(), 7)).toEqual([
      "u3",
      "u4",
      "u5",
      "u1",
      "u2",
    ]);
  });

  it("skips users who already reviewed the place", () => {
    const picked = pickReviewers(3, USERS, new Set(["u1", "u3"]));
    expect(picked).toEqual(["u2", "u4", "u5"]);
  });

  it("never returns a user that already reviewed, whatever the offset", () => {
    const taken = new Set(["u2", "u5"]);
    for (let offset = 0; offset < 12; offset++) {
      const picked = pickReviewers(3, USERS, taken, offset);
      expect(picked.some((id) => taken.has(id))).toBe(false);
      expect(new Set(picked).size).toBe(3);
    }
  });

  it("is the same every time for the same input, so a rerun of the seed changes nothing", () => {
    const first = pickReviewers(4, USERS, new Set(["u3"]), 2);
    const second = pickReviewers(4, USERS, new Set(["u3"]), 2);
    expect(second).toEqual(first);
  });

  it("returns nobody when no review is needed", () => {
    expect(pickReviewers(0, USERS)).toEqual([]);
  });

  it("stops with an error when the place has more reviews than users", () => {
    expect(() => pickReviewers(6, USERS)).toThrow(
      /needs 6 reviewers but only 5/
    );
  });

  it("counts only the users who can still review when it checks that there are enough", () => {
    expect(() => pickReviewers(4, USERS, new Set(["u1", "u2"]))).toThrow(
      /needs 4 reviewers but only 3/
    );
    expect(() => pickReviewers(1, [], new Set())).toThrow(/only 0/);
  });

  it("counts a user listed twice only once", () => {
    expect(pickReviewers(2, ["u1", "u1", "u2"])).toEqual(["u1", "u2"]);
    expect(() => pickReviewers(3, ["u1", "u1", "u2"])).toThrow(
      /needs 3 reviewers but only 2/
    );
  });

  it("does not change its inputs", () => {
    const users = ["u1", "u2", "u3"];
    const taken = new Set(["u2"]);
    pickReviewers(2, users, taken, 1);
    expect(users).toEqual(["u1", "u2", "u3"]);
    expect([...taken]).toEqual(["u2"]);
  });
});
