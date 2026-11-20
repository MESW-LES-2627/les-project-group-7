import { describe, it, expect } from "vitest";
import { validateTripEdit } from "./trip-edit";
import { TRIP_NAME_MAX_LENGTH } from "./trip-validation";

const today = new Date("2026-12-10T00:00:00.000Z");
const current = {
  startDate: new Date("2026-12-12T00:00:00.000Z"),
  endDate: new Date("2026-12-14T00:00:00.000Z"),
};
const valid = {
  name: "  Porto  ",
  startDate: "2026-12-12",
  endDate: "2026-12-14",
};

describe("validateTripEdit", () => {
  it("accepts the same dates and trims the name", () => {
    const result = validateTripEdit(valid, current, today);

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Porto",
        startDate: current.startDate,
        endDate: current.endDate,
        confirmedStops: null,
      },
    });
  });

  it("reads confirmedStops only when it is a whole number of stops", () => {
    const read = (confirmedStops: unknown) => {
      const result = validateTripEdit(
        { ...valid, confirmedStops },
        current,
        today
      );
      return result.ok ? result.value.confirmedStops : "invalid";
    };

    expect(read(2)).toBe(2);
    expect(read(0)).toBe(0);
    expect(read(undefined)).toBeNull();
    expect(read(true)).toBeNull();
    expect(read("2")).toBeNull();
    expect(read(-1)).toBeNull();
    expect(read(1.5)).toBeNull();
  });

  it("gives one message for each wrong field", () => {
    const result = validateTripEdit(
      { name: " ", startDate: "2026-02-30", endDate: "" },
      current,
      today
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        name: "Give the trip a name",
        startDate: "Use a real date like 2026-12-01 for the start date",
        endDate: "Choose the end date",
      },
    });
  });

  it("refuses a name that is too long", () => {
    const result = validateTripEdit(
      { ...valid, name: "x".repeat(TRIP_NAME_MAX_LENGTH + 1) },
      current,
      today
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a new start date in the past", () => {
    const result = validateTripEdit(
      { ...valid, startDate: "2026-12-09" },
      current,
      today
    );

    expect(result).toEqual({
      ok: false,
      errors: { startDate: "The trip cannot start in the past" },
    });
  });

  it("does not check the start date against today when it did not change", () => {
    // A trip that has already started can be renamed or made longer (note of #55).
    const started = {
      startDate: new Date("2026-12-01T00:00:00.000Z"),
      endDate: new Date("2026-12-03T00:00:00.000Z"),
    };

    const result = validateTripEdit(
      { name: "Porto", startDate: "2026-12-01", endDate: "2026-12-05" },
      started,
      today
    );

    expect(result.ok).toBe(true);
  });

  it("refuses an end date before the start date", () => {
    const result = validateTripEdit(
      { ...valid, endDate: "2026-12-11" },
      current,
      today
    );

    expect(result).toEqual({
      ok: false,
      errors: { endDate: "The end date cannot be before the start date" },
    });
  });

  it("refuses a trip of more than 14 days", () => {
    const result = validateTripEdit(
      { ...valid, endDate: "2026-12-26" },
      current,
      today
    );

    expect(result).toEqual({
      ok: false,
      errors: { endDate: "A trip can have 14 days at most" },
    });
  });

  it("treats a body that is not an object as empty", () => {
    const result = validateTripEdit(null, current, today);

    expect(result.ok).toBe(false);
  });
});
