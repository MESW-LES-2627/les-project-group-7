import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { editTrip } from "./edit-trip";

const form = { name: "Porto", startDate: "2030-05-10", endDate: "2030-05-12" };

function answer(status: number, body?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: () => Promise.resolve(body),
    })
  );
}

describe("editTrip", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("sends the form with confirmRemoval to PATCH /api/trips/[id]", async () => {
    answer(200, {});

    await editTrip("a/b", form, 3);

    expect(fetch).toHaveBeenCalledWith("/api/trips/a%2Fb", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, confirmedStops: 3 }),
    });
  });

  it("sends no confirmedStops unless it is asked to", async () => {
    answer(200, {});

    await editTrip("t1", form);

    const sent = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(sent.confirmedStops).toBeUndefined();
  });

  it("answers saved for a 200", async () => {
    answer(200, {});

    expect(await editTrip("t1", form)).toEqual({ status: "saved" });
  });

  it("gives the days that would go for a 409", async () => {
    const days = [{ dayNumber: 3, date: "2030-05-12", stops: 2 }];
    answer(409, { error: "x", removal: { days } });

    expect(await editTrip("t1", form)).toEqual({ status: "confirm", days });
  });

  it("gives the message of each field for a 400 and drops unknown fields", async () => {
    answer(400, {
      error: "Give the trip a name",
      errors: { name: "Give the trip a name", cityId: "nowhere to show" },
    });

    expect(await editTrip("t1", form)).toEqual({
      status: "error",
      errors: { name: "Give the trip a name" },
      message: "Give the trip a name",
    });
  });

  it.each([
    [401, "Your session expired. Log in again."],
    [404, "This trip no longer exists."],
    [500, "Could not save the trip. Please try again."],
  ])("gives a message for a %i", async (status, message) => {
    answer(status, {});

    expect(await editTrip("t1", form)).toEqual({
      status: "error",
      errors: {},
      message,
    });
  });

  it("gives the generic message when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await editTrip("t1", form)).toMatchObject({
      status: "error",
      message: "Could not save the trip. Please try again.",
    });
  });
});
