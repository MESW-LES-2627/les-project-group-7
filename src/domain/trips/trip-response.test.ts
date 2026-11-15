import { describe, it, expect } from "vitest";
import {
  toTripResponse,
  toTripSummaryResponse,
  type TripRecord,
  type TripSummaryRecord,
} from "./trip-response";

const record: TripRecord = {
  id: "trip-1",
  name: "Weekend in Paris",
  cityId: "city-paris",
  startDate: new Date("2026-12-01T00:00:00.000Z"),
  endDate: new Date("2026-12-03T00:00:00.000Z"),
  createdAt: new Date("2026-11-12T10:00:00.000Z"),
  days: [
    { id: "d3", dayNumber: 3, date: new Date("2026-12-03T00:00:00.000Z") },
    { id: "d1", dayNumber: 1, date: new Date("2026-12-01T00:00:00.000Z") },
    { id: "d2", dayNumber: 2, date: new Date("2026-12-02T00:00:00.000Z") },
  ],
  itinerary: {
    id: "it-1",
    mode: "MANUAL",
    budgetLevel: null,
    dayStart: null,
    dayEnd: null,
  },
};

describe("toTripResponse", () => {
  it("sends the dates as YYYY-MM-DD", () => {
    const response = toTripResponse(record);

    expect(response.startDate).toBe("2026-12-01");
    expect(response.endDate).toBe("2026-12-03");
    expect(response.createdAt).toBe("2026-11-12T10:00:00.000Z");
  });

  it("lists Day 1, Day 2 and Day 3 with their dates, whatever order they come in (AC2)", () => {
    expect(toTripResponse(record).days).toEqual([
      { id: "d1", dayNumber: 1, date: "2026-12-01" },
      { id: "d2", dayNumber: 2, date: "2026-12-02" },
      { id: "d3", dayNumber: 3, date: "2026-12-03" },
    ]);
  });

  it("does not change the list of days it was given", () => {
    const days = [...record.days];
    toTripResponse(record);

    expect(record.days).toEqual(days);
  });

  it("has the itinerary of the trip, empty: manual and without settings", () => {
    expect(toTripResponse(record).itinerary).toEqual({
      id: "it-1",
      mode: "MANUAL",
      budgetLevel: null,
      dayStart: null,
      dayEnd: null,
    });
  });

  it("keeps the settings of the itinerary when the person has set them", () => {
    const response = toTripResponse({
      ...record,
      itinerary: {
        ...record.itinerary,
        budgetLevel: "€€",
        dayStart: "09:30",
        dayEnd: "21:00",
      },
    });

    expect(response.itinerary).toMatchObject({
      budgetLevel: "€€",
      dayStart: "09:30",
      dayEnd: "21:00",
    });
  });

  it("does not have a budget level, hours or types on the trip itself", () => {
    const response = toTripResponse(record);

    expect(response).not.toHaveProperty("budgetLevel");
    expect(response).not.toHaveProperty("dayStart");
    expect(response).not.toHaveProperty("allowedCategories");
  });
});

describe("toTripSummaryResponse", () => {
  const summaryRecord: TripSummaryRecord = {
    id: "trip-1",
    name: "Weekend in Paris",
    city: { id: "c1", name: "Paris", country: "France" },
    startDate: new Date("2026-12-01T00:00:00.000Z"),
    endDate: new Date("2026-12-03T00:00:00.000Z"),
    createdAt: new Date("2026-11-12T10:00:00.000Z"),
    days: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
  };

  it("formats the summary with YYYY-MM-DD dates and day count", () => {
    const summary = toTripSummaryResponse(summaryRecord);

    expect(summary).toEqual({
      id: "trip-1",
      name: "Weekend in Paris",
      city: { id: "c1", name: "Paris", country: "France" },
      startDate: "2026-12-01",
      endDate: "2026-12-03",
      daysCount: 3,
      createdAt: "2026-11-12T10:00:00.000Z",
    });
  });
});
