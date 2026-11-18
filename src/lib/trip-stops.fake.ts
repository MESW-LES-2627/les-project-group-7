/**
 * An in-memory copy of the tables the Stops API uses, for the tests of its routes. It answers the
 * few Prisma calls the routes make, so the real ordering rules run in the tests and what is saved can
 * be checked afterwards.
 */

export interface FakeStop {
  id: string;
  itineraryId: string;
  dayId: string;
  placeId: string;
  position: number;
  visitTime: string | null;
}

export interface FakeData {
  /** The one trip: it belongs to `userId`, is in `cityId` and has these days and this itinerary. */
  trip: { id: string; userId: string; cityId: string; itineraryId: string };
  days: { id: string; dayNumber: number }[];
  places: { id: string; cityId: string }[];
  stops: FakeStop[];
}

/** A trip "t1" of user "u1" in "porto", with days d1, d2 and d3, and three places in Porto. */
export function sampleData(stops: Partial<FakeStop>[] = []): FakeData {
  return {
    trip: { id: "t1", userId: "u1", cityId: "porto", itineraryId: "i1" },
    days: [
      { id: "d1", dayNumber: 1 },
      { id: "d2", dayNumber: 2 },
      { id: "d3", dayNumber: 3 },
    ],
    places: [
      { id: "p1", cityId: "porto" },
      { id: "p2", cityId: "porto" },
      { id: "p3", cityId: "porto" },
      { id: "p4", cityId: "porto" },
      { id: "far", cityId: "lisboa" },
    ],
    stops: stops.map((stop, index) => ({
      id: `s${index + 1}`,
      itineraryId: "i1",
      dayId: "d1",
      placeId: `p${index + 1}`,
      position: index + 1,
      visitTime: null,
      ...stop,
    })),
  };
}

/** The stop ids of a day in position order. */
export function dayOrder(data: FakeData, dayId: string): string[] {
  return data.stops
    .filter((stop) => stop.dayId === dayId)
    .sort((a, b) => a.position - b.position)
    .map((stop) => stop.id);
}

/** The positions of a day, to check that they are 1, 2, 3 without gaps. */
export function dayPositions(data: FakeData, dayId: string): number[] {
  return data.stops
    .filter((stop) => stop.dayId === dayId)
    .map((stop) => stop.position)
    .sort((a, b) => a - b);
}

function pick<T extends object>(row: T, select?: Record<string, boolean>) {
  if (!select) return { ...row };
  return Object.fromEntries(Object.entries(row).filter(([key]) => select[key]));
}

/**
 * The `prisma` object for `vi.mock("@/lib/prisma")`. The transaction runs its function on the same
 * data and, like the database, undoes what it did when the function throws.
 */
export function fakePrisma(data: FakeData) {
  const dayNumber = (dayId: string) =>
    data.days.find((day) => day.id === dayId)?.dayNumber ?? 0;

  const tx = {
    trip: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; userId: string };
      }) =>
        where.id === data.trip.id && where.userId === data.trip.userId
          ? {
              cityId: data.trip.cityId,
              days: data.days.map((day) => ({ id: day.id })),
              itinerary: { id: data.trip.itineraryId },
            }
          : null,
    },
    place: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        data.places.find((place) => place.id === where.id) ?? null,
    },
    itineraryStop: {
      findMany: async ({
        where,
        select,
      }: {
        where: { itineraryId: string };
        select?: Record<string, boolean>;
      }) =>
        data.stops
          .filter((stop) => stop.itineraryId === where.itineraryId)
          .sort(
            (a, b) =>
              dayNumber(a.dayId) - dayNumber(b.dayId) || a.position - b.position
          )
          .map((stop) => pick(stop, select)),
      update: async ({
        where,
        data: changes,
      }: {
        where: { id: string };
        data: Partial<FakeStop>;
      }) => {
        const stop = data.stops.find((item) => item.id === where.id);
        if (!stop) throw new Error("Record to update not found");
        Object.assign(stop, changes);
        return { ...stop };
      },
      create: async ({
        data: row,
        select,
      }: {
        data: Omit<FakeStop, "id">;
        select?: Record<string, boolean>;
      }) => {
        const stop = { id: `new${data.stops.length + 1}`, ...row };
        data.stops.push(stop);
        return pick(stop, select);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = data.stops.findIndex((stop) => stop.id === where.id);
        if (index === -1) throw new Error("Record to delete not found");
        return data.stops.splice(index, 1)[0];
      },
    },
  };

  return {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = structuredClone(data.stops);
      try {
        return await work(tx);
      } catch (error) {
        data.stops.splice(0, data.stops.length, ...before);
        throw error;
      }
    },
  };
}
