import { describe, it, expect } from "vitest";
import { TRIP_NAME_MAX_LENGTH, validateTripInput } from "./trip-validation";

const TODAY = new Date("2026-11-12T00:00:00.000Z");

const valid = {
  name: "Weekend in Paris",
  cityId: "city-paris",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
};

function errorsOf(body: unknown) {
  const result = validateTripInput(body, TODAY);
  if (result.ok) {
    throw new Error("expected the trip to be refused");
  }
  return result.errors;
}

describe("validateTripInput: a good trip (AC1)", () => {
  it("accepts a name, a city and dates, and nothing else is needed", () => {
    expect(validateTripInput(valid, TODAY)).toEqual({
      ok: true,
      value: {
        name: "Weekend in Paris",
        cityId: "city-paris",
        startDate: new Date("2026-12-01T00:00:00.000Z"),
        endDate: new Date("2026-12-03T00:00:00.000Z"),
      },
    });
  });

  it("trims the name and the city", () => {
    const result = validateTripInput(
      { ...valid, name: "  Paris  ", cityId: " city-paris " },
      TODAY
    );

    expect(result.ok && [result.value.name, result.value.cityId]).toEqual([
      "Paris",
      "city-paris",
    ]);
  });

  it("ignores fields that are not part of a trip, like a budget level, hours or types", () => {
    const result = validateTripInput(
      {
        ...valid,
        budgetLevel: "€€€€",
        dayStart: "03:00",
        allowedCategories: ["NOT_A_TYPE"],
        userId: "someone-else",
      },
      TODAY
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Weekend in Paris",
        cityId: "city-paris",
        startDate: new Date("2026-12-01T00:00:00.000Z"),
        endDate: new Date("2026-12-03T00:00:00.000Z"),
      },
    });
  });
});

describe("validateTripInput: the dates (AC3, AC4, AC5)", () => {
  it("accepts a trip of one day", () => {
    expect(
      validateTripInput(
        { ...valid, startDate: "2026-12-01", endDate: "2026-12-01" },
        TODAY
      ).ok
    ).toBe(true);
  });

  it("refuses an end date before the start date", () => {
    expect(errorsOf({ ...valid, endDate: "2026-11-30" })).toEqual({
      endDate: "The end date cannot be before the start date",
    });
  });

  it("accepts a trip that starts today and refuses one that started yesterday", () => {
    expect(
      validateTripInput(
        { ...valid, startDate: "2026-11-12", endDate: "2026-11-14" },
        TODAY
      ).ok
    ).toBe(true);
    expect(
      errorsOf({ ...valid, startDate: "2026-11-11", endDate: "2026-11-14" })
    ).toEqual({ startDate: "The trip cannot start in the past" });
  });

  it("accepts a trip of 14 days and refuses one of 15", () => {
    expect(
      validateTripInput(
        { ...valid, startDate: "2026-12-01", endDate: "2026-12-14" },
        TODAY
      ).ok
    ).toBe(true);
    expect(
      errorsOf({ ...valid, startDate: "2026-12-01", endDate: "2026-12-15" })
    ).toEqual({ endDate: "A trip can have 14 days at most" });
  });

  it("refuses dates that are not real or not in the format", () => {
    expect(errorsOf({ ...valid, startDate: "2026-02-30" }).startDate).toMatch(
      /real date/
    );
    expect(errorsOf({ ...valid, endDate: "03/12/2026" }).endDate).toMatch(
      /real date/
    );
    expect(errorsOf({ ...valid, startDate: 20261201 }).startDate).toMatch(
      /real date/
    );
  });

  it("uses the date that was given as today, the one of the city of the trip", () => {
    // It is already the 13th in Kiritimati while it is still the 12th in UTC.
    const kiritimatiToday = new Date("2026-11-13T00:00:00.000Z");
    const body = { ...valid, startDate: "2026-11-12", endDate: "2026-11-14" };

    expect(validateTripInput(body, TODAY).ok).toBe(true);
    expect(validateTripInput(body, kiritimatiToday).ok).toBe(false);
  });
});

describe("validateTripInput: the form is incomplete (AC7)", () => {
  it("says which fields are missing, all at once", () => {
    expect(errorsOf({})).toEqual({
      name: "Give the trip a name",
      cityId: "Choose a city",
      startDate: "Choose the start date",
      endDate: "Choose the end date",
    });
  });

  it("treats a body that is not an object as an empty form", () => {
    expect(Object.keys(errorsOf(null))).toHaveLength(4);
    expect(Object.keys(errorsOf("trip"))).toHaveLength(4);
    expect(Object.keys(errorsOf([valid]))).toHaveLength(4);
  });

  it("refuses a name made only of spaces", () => {
    expect(errorsOf({ ...valid, name: "    " })).toEqual({
      name: "Give the trip a name",
    });
  });

  it("refuses a name that is too long and accepts one at the limit", () => {
    expect(
      validateTripInput(
        { ...valid, name: "a".repeat(TRIP_NAME_MAX_LENGTH) },
        TODAY
      ).ok
    ).toBe(true);
    expect(
      errorsOf({ ...valid, name: "a".repeat(TRIP_NAME_MAX_LENGTH + 1) }).name
    ).toMatch(/100 characters at most/);
  });

  it("reports several problems together", () => {
    const errors = errorsOf({ ...valid, name: "", endDate: "2026-11-30" });

    expect(Object.keys(errors).sort()).toEqual(["endDate", "name"]);
  });
});
