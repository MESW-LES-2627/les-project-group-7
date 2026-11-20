import { describe, it, expect, vi, afterEach } from "vitest";
import { addStop, fetchStops, removeStop, updateStop } from "./itinerary-stops";
import {
  ALREADY_PLANNED_MESSAGE,
  CONCURRENT_CHANGE_MESSAGE,
  GENERIC_STOP_MESSAGE,
} from "@/domain/itinerary/itinerary-editor";

const stops = [
  {
    id: "s1",
    dayId: "d1",
    placeId: "p1",
    position: 1,
    visitTime: null,
    place: {
      id: "p1",
      name: "Sé",
      category: "MONUMENT",
      address: "Terreiro da Sé",
      latitude: 41.14,
      longitude: -8.61,
      priceLevel: null,
    },
  },
];

function stubFetch(status: number, body?: unknown) {
  const response =
    body === undefined
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("addStop", () => {
  it("posts the body as JSON and gives the stops in their new order", async () => {
    stubFetch(201, { stop: stops[0], stops });

    const result = await addStop("t1", { dayId: "d1", placeId: "p1" });

    expect(result).toEqual({ ok: true, stops });
    expect(fetch).toHaveBeenCalledWith("/api/trips/t1/stops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId: "d1", placeId: "p1" }),
    });
  });

  it("says the place is already planned on 409 ALREADY_PLANNED", async () => {
    stubFetch(409, { error: "x", reason: "ALREADY_PLANNED" });

    const result = await addStop("t1", { dayId: "d1", placeId: "p1" });

    expect(result).toEqual({
      ok: false,
      message: ALREADY_PLANNED_MESSAGE,
      reason: "ALREADY_PLANNED",
      reload: false,
    });
  });

  it("has a general message when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const result = await addStop("t1", { dayId: "d1", placeId: "p1" });

    expect(result).toMatchObject({ ok: false, message: GENERIC_STOP_MESSAGE });
  });
});

describe("updateStop", () => {
  it("sends only the visit time when the time changes, so the API puts the stop among the times", async () => {
    stubFetch(200, { stop: stops[0], stops });

    await updateStop("t1", "s1", { visitTime: "12:00" });

    expect(fetch).toHaveBeenCalledWith("/api/trips/t1/stops/s1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitTime: "12:00" }),
    });
  });

  it("asks to try again and to read the itinerary again on a 409 without a reason", async () => {
    stubFetch(409, { error: "changed" });

    const result = await updateStop("t1", "s1", { position: 2 });

    expect(result).toEqual({
      ok: false,
      message: CONCURRENT_CHANGE_MESSAGE,
      reason: null,
      reload: true,
    });
  });
});

describe("removeStop", () => {
  it("is done on 204 (AC4)", async () => {
    stubFetch(204);

    expect(await removeStop("t1", "s1")).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/api/trips/t1/stops/s1", {
      method: "DELETE",
    });
  });

  it("counts a stop that is already gone as done", async () => {
    stubFetch(404, { error: "gone", reason: "STOP_NOT_FOUND" });

    expect(await removeStop("t1", "s1")).toEqual({ ok: true });
  });

  it("is not done for a trip that is gone", async () => {
    stubFetch(404, { error: "Trip not found" });

    expect(await removeStop("t1", "s1")).toMatchObject({
      ok: false,
      reload: true,
    });
  });
});

describe("fetchStops", () => {
  it("reads the stops of the trip", async () => {
    stubFetch(200, { stops });

    expect(await fetchStops("t 1")).toEqual({ ok: true, stops });
    expect(fetch).toHaveBeenCalledWith("/api/trips/t%201/stops", undefined);
  });
});
