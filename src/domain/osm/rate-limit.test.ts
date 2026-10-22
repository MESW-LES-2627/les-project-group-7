import { describe, it, expect } from "vitest";
import { createMinIntervalLimiter } from "./rate-limit";

describe("createMinIntervalLimiter", () => {
  it("allows one call per interval and refuses the ones in between", () => {
    let time = 10_000;
    const allow = createMinIntervalLimiter(1000, () => time);

    expect(allow()).toBe(true);
    time += 999;
    expect(allow()).toBe(false);
    time += 1;
    expect(allow()).toBe(true);
  });

  it("does not move the window when a call is refused", () => {
    let time = 0;
    const allow = createMinIntervalLimiter(1000, () => time);

    expect(allow()).toBe(true);
    time = 500;
    expect(allow()).toBe(false);
    time = 1000;
    expect(allow()).toBe(true);
  });
});
