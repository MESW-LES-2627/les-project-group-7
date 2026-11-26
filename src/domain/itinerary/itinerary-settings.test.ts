import { describe, expect, it } from "vitest";
import {
  BUDGET_LEVEL_ERROR,
  HOUR_ORDER_ERROR,
  isBudgetLevel,
  MISSING_SETTING_ERROR,
  NOT_AN_OBJECT_ERROR,
  validateItinerarySettings,
} from "./itinerary-settings";
import { VISIT_TIME_ERROR } from "./visit-time";

const empty = { budgetLevel: null, dayStart: null, dayEnd: null };

describe("isBudgetLevel", () => {
  it("accepts €, €€ and €€€", () => {
    expect(isBudgetLevel("€")).toBe(true);
    expect(isBudgetLevel("€€")).toBe(true);
    expect(isBudgetLevel("€€€")).toBe(true);
  });

  it("refuses FREE, which is a price level of a place and not a budget level", () => {
    expect(isBudgetLevel("FREE")).toBe(false);
  });

  it("refuses anything else", () => {
    for (const value of ["", "€€€€", "EUR", "cheap", 1, null, undefined, {}]) {
      expect(isBudgetLevel(value)).toBe(false);
    }
  });
});

describe("validateItinerarySettings: all settings are optional (AC9)", () => {
  it("accepts all three empty, which clears them", () => {
    expect(validateItinerarySettings(empty)).toEqual({
      ok: true,
      value: empty,
    });
  });

  it("reads an empty text as no setting", () => {
    expect(
      validateItinerarySettings({ budgetLevel: "", dayStart: "", dayEnd: "" })
    ).toEqual({ ok: true, value: empty });
  });

  it("saves a budget level of €, €€ or €€€", () => {
    for (const level of ["€", "€€", "€€€"]) {
      expect(
        validateItinerarySettings({ ...empty, budgetLevel: level })
      ).toEqual({ ok: true, value: { ...empty, budgetLevel: level } });
    }
  });

  it("saves both hour limits", () => {
    expect(
      validateItinerarySettings({
        budgetLevel: "€€",
        dayStart: "09:00",
        dayEnd: "20:00",
      })
    ).toEqual({
      ok: true,
      value: { budgetLevel: "€€", dayStart: "09:00", dayEnd: "20:00" },
    });
  });

  it("saves only the start, or only the end", () => {
    expect(validateItinerarySettings({ ...empty, dayStart: "09:00" })).toEqual({
      ok: true,
      value: { ...empty, dayStart: "09:00" },
    });
    expect(validateItinerarySettings({ ...empty, dayEnd: "20:00" })).toEqual({
      ok: true,
      value: { ...empty, dayEnd: "20:00" },
    });
  });

  it("accepts the first and the last minute of the day", () => {
    expect(
      validateItinerarySettings({
        ...empty,
        dayStart: "00:00",
        dayEnd: "23:59",
      })
    ).toEqual({
      ok: true,
      value: { ...empty, dayStart: "00:00", dayEnd: "23:59" },
    });
  });

  it("ignores other keys of the body", () => {
    expect(
      validateItinerarySettings({
        ...empty,
        budgetLevel: "€",
        mode: "GENERATED",
      })
    ).toEqual({ ok: true, value: { ...empty, budgetLevel: "€" } });
  });
});

describe("validateItinerarySettings: wrong settings are refused (AC10)", () => {
  it("refuses FREE and any other budget level", () => {
    for (const level of ["FREE", "€€€€", "cheap", 2]) {
      expect(
        validateItinerarySettings({ ...empty, budgetLevel: level })
      ).toEqual({ ok: false, errors: { budgetLevel: BUDGET_LEVEL_ERROR } });
    }
  });

  it("refuses a time that is not a time of the day", () => {
    for (const time of ["24:00", "9:30", "09:60", "09:30:00", "noon", 930]) {
      expect(validateItinerarySettings({ ...empty, dayStart: time })).toEqual({
        ok: false,
        errors: { dayStart: VISIT_TIME_ERROR },
      });
      expect(validateItinerarySettings({ ...empty, dayEnd: time })).toEqual({
        ok: false,
        errors: { dayEnd: VISIT_TIME_ERROR },
      });
    }
  });

  it("refuses a start after the end", () => {
    expect(
      validateItinerarySettings({
        ...empty,
        dayStart: "20:00",
        dayEnd: "09:00",
      })
    ).toEqual({ ok: false, errors: { dayEnd: HOUR_ORDER_ERROR } });
  });

  it("refuses a start equal to the end, because it leaves no time", () => {
    expect(
      validateItinerarySettings({
        ...empty,
        dayStart: "12:00",
        dayEnd: "12:00",
      })
    ).toEqual({ ok: false, errors: { dayEnd: HOUR_ORDER_ERROR } });
  });

  it("accepts a start one minute before the end", () => {
    expect(
      validateItinerarySettings({
        ...empty,
        dayStart: "11:59",
        dayEnd: "12:00",
      }).ok
    ).toBe(true);
  });

  it("does not compare the hours when one of them is already wrong", () => {
    expect(
      validateItinerarySettings({
        ...empty,
        dayStart: "25:00",
        dayEnd: "09:00",
      })
    ).toEqual({ ok: false, errors: { dayStart: VISIT_TIME_ERROR } });
  });

  it("gives one message for each wrong setting", () => {
    expect(
      validateItinerarySettings({
        budgetLevel: "FREE",
        dayStart: "8am",
        dayEnd: "25:00",
      })
    ).toEqual({
      ok: false,
      errors: {
        budgetLevel: BUDGET_LEVEL_ERROR,
        dayStart: VISIT_TIME_ERROR,
        dayEnd: VISIT_TIME_ERROR,
      },
    });
  });

  it("asks for every setting, so that none is cleared because it was forgotten", () => {
    expect(validateItinerarySettings({ budgetLevel: "€" })).toEqual({
      ok: false,
      errors: {
        dayStart: MISSING_SETTING_ERROR,
        dayEnd: MISSING_SETTING_ERROR,
      },
    });
  });

  it("refuses a body that is not an object", () => {
    for (const body of [null, "€", 3, ["€", null, null]]) {
      expect(validateItinerarySettings(body)).toEqual({
        ok: false,
        errors: {
          budgetLevel: NOT_AN_OBJECT_ERROR,
          dayStart: NOT_AN_OBJECT_ERROR,
          dayEnd: NOT_AN_OBJECT_ERROR,
        },
      });
    }
  });
});
