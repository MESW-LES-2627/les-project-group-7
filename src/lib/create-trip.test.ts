import { describe, it, expect, vi, afterEach } from "vitest";
import { createTrip } from "./create-trip";

const form = {
  name: "Porto",
  cityId: "c1",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("createTrip", () => {
  it("posts the form and returns the id of the new trip on 201", async () => {
    const fetchMock = stubFetch(201, { id: "t1" });

    expect(await createTrip(form)).toEqual({ ok: true, id: "t1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(form),
      })
    );
  });

  it("returns the errors of each field on 400", async () => {
    stubFetch(400, {
      error: "Name is required",
      errors: { name: "Name is required", cityId: "Choose a city" },
    });

    expect(await createTrip(form)).toEqual({
      ok: false,
      errors: { name: "Name is required", cityId: "Choose a city" },
      message: "Name is required",
    });
  });

  it("gives a generic message and no field errors on 403 and 500", async () => {
    for (const status of [403, 500]) {
      stubFetch(status, { error: "x" });
      const result = await createTrip(form);
      expect(result).toMatchObject({ ok: false, errors: {} });
    }
  });

  it("tells the user to log in again on 401", async () => {
    stubFetch(401, { error: "x" });

    expect(await createTrip(form)).toEqual({
      ok: false,
      errors: {},
      message: "Your session expired. Log in again.",
    });
  });

  it("ignores errors that are not an object on 400", async () => {
    stubFetch(400, { error: "Bad", errors: "boom" });

    expect(await createTrip(form)).toEqual({
      ok: false,
      errors: {},
      message: "Bad",
    });
  });

  it("keeps only the errors of the four fields of the form on 400", async () => {
    stubFetch(400, {
      error: "Bad",
      errors: { budget: "Unknown field", name: "Name is required" },
    });

    expect(await createTrip(form)).toEqual({
      ok: false,
      errors: { name: "Name is required" },
      message: "Bad",
    });
  });

  it("shows the general message when a 400 has no error for a known field", async () => {
    stubFetch(400, { error: "Bad", errors: { budget: "Unknown field" } });

    expect(await createTrip(form)).toEqual({
      ok: false,
      errors: {},
      message: "Bad",
    });
  });

  it("gives a generic message when the response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      })
    );

    expect(await createTrip(form)).toMatchObject({ ok: false, errors: {} });
  });

  it("gives a generic message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(await createTrip(form)).toMatchObject({ ok: false, errors: {} });
  });
});
