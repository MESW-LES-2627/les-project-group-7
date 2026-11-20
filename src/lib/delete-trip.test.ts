import { describe, it, expect, vi, afterEach } from "vitest";
import { deleteTrip } from "./delete-trip";

function stubFetch(status: number) {
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deleteTrip", () => {
  it("is done on 204", async () => {
    stubFetch(204);

    const result = await deleteTrip("t1");

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("/api/trips/t1", { method: "DELETE" });
  });

  it("counts 404 as done: the trip is already gone", async () => {
    stubFetch(404);

    const result = await deleteTrip("t1");

    expect(result).toEqual({ ok: true });
  });

  it("asks to log in again on 401", async () => {
    stubFetch(401);

    const result = await deleteTrip("t1");

    expect(result).toEqual({
      ok: false,
      message: "Your session expired. Log in again.",
    });
  });

  it("gives a generic message on a server 500 error", async () => {
    stubFetch(500);

    const result = await deleteTrip("t1");

    expect(result).toEqual({
      ok: false,
      message: "Could not delete the trip. Please try again.",
    });
  });

  it("gives a generic message on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await deleteTrip("t1");

    expect(result).toEqual({
      ok: false,
      message: "Could not delete the trip. Please try again.",
    });
  });
});
