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

export interface FakePlace {
  id: string;
  osmId?: string | null;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: string | null;
  cityId: string;
  source?: string;
}

export interface FakeData {
  /** The one trip: it belongs to `userId`, is in `cityId` and has these days and this itinerary. */
  trip: { id: string; userId: string; cityId: string; itineraryId: string };
  days: { id: string; dayNumber: number }[];
  places: FakePlace[];
  stops: FakeStop[];
}

function place(id: string, cityId: string, index: number): FakePlace {
  return {
    id,
    osmId: null,
    name: `Place ${id}`,
    category: "MONUMENT",
    address: `${index} Rua do Teste`,
    latitude: Number((41.15 + index / 1000).toFixed(3)),
    longitude: -8.62,
    priceLevel: null,
    cityId,
  };
}

/** A trip "t1" of user "u1" in "city-porto", with days d1, d2 and d3, and three places in Porto. */
export function sampleData(stops: Partial<FakeStop>[] = []): FakeData {
  return {
    trip: { id: "t1", userId: "u1", cityId: "city-porto", itineraryId: "i1" },
    days: [
      { id: "d1", dayNumber: 1 },
      { id: "d2", dayNumber: 2 },
      { id: "d3", dayNumber: 3 },
    ],
    places: [
      ...["p1", "p2", "p3", "p4"].map((id, index) =>
        place(id, "city-porto", index)
      ),
      place("far", "city-lisboa", 9),
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

type Select = Record<string, boolean | { select: Record<string, boolean> }>;

function pick<T extends object>(row: T, select?: Select) {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => select[key] === true)
  );
}

/**
 * The `prisma` object for `vi.mock("@/lib/prisma")`. The transaction runs its function on the same
 * data and, like the database, undoes what it did when the function throws.
 */
export function fakePrisma(
  data: FakeData,
  options: { placesLookupMisses?: boolean } = {}
) {
  const dayNumber = (dayId: string) =>
    data.days.find((day) => day.id === dayId)?.dayNumber ?? 0;

  /** A stop as `select` asks for it: its own fields and, if asked, the place with its chosen fields. */
  const shape = (stop: FakeStop, select?: Select) => {
    const own = pick(stop, select);
    const placeSelect = select?.place;
    if (typeof placeSelect !== "object") return own;
    const place = data.places.find((item) => item.id === stop.placeId);
    return { ...own, place: place && pick(place, placeSelect.select) };
  };

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
      findUnique: async ({
        where,
      }: {
        where: { id?: string; osmId?: string };
      }) => {
        // `placesLookupMisses` makes the look-up find nothing, as if another request had not saved the
        // place yet, while the database still refuses a second save of it.
        if (options.placesLookupMisses) return null;
        return (
          data.places.find((item) =>
            where.id !== undefined
              ? item.id === where.id
              : item.osmId === where.osmId
          ) ?? null
        );
      },
      create: async ({ data: row }: { data: FakePlace }) => {
        // The database refuses a second place with the same id or the same OpenStreetMap id.
        if (
          data.places.some(
            (item) =>
              item.id === row.id || (row.osmId && item.osmId === row.osmId)
          )
        ) {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        }
        data.places.push({ ...row });
        return { ...row };
      },
    },
    itineraryStop: {
      findMany: async ({
        where,
        select,
      }: {
        where: { itineraryId: string };
        select?: Select;
      }) =>
        data.stops
          .filter((stop) => stop.itineraryId === where.itineraryId)
          .sort(
            (a, b) =>
              dayNumber(a.dayId) - dayNumber(b.dayId) || a.position - b.position
          )
          .map((stop) => shape(stop, select)),
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
        select?: Select;
      }) => {
        const stop = { id: `new${data.stops.length + 1}`, ...row };
        data.stops.push(stop);
        return shape(stop, select);
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = data.stops.findIndex((stop) => stop.id === where.id);
        if (index === -1) throw new Error("Record to delete not found");
        return data.stops.splice(index, 1)[0];
      },
    },
  };

  return {
    ...tx,
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = structuredClone(data.stops);
      const placesBefore = structuredClone(data.places);
      try {
        return await work(tx);
      } catch (error) {
        data.stops.splice(0, data.stops.length, ...before);
        data.places.splice(0, data.places.length, ...placesBefore);
        throw error;
      }
    },
  };
}
