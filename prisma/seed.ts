import { PrismaClient, PlaceCategory } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { refreshPlaceStats, markPlaceVisited } from "../src/lib/place-stats";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

interface DemoUser {
  id: string;
  username: string;
  email: string;
}

/** The demo users (US-B2-01) live in prisma/data/demo-users.json: this is fake data, not app code. */
const DEMO_USERS: DemoUser[] = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "prisma/data/demo-users.json"),
    "utf-8"
  )
);

/** Documented in the README. Set DEMO_PASSWORD to use another one (for example on prod). */
const DEFAULT_DEMO_PASSWORD = "tripbook-demo";

function demoPassword() {
  const password = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
  if (password.length < 8 || password.length > 128) {
    throw new Error("DEMO_PASSWORD must have 8 to 128 characters");
  }
  return password;
}

/**
 * Creates the demo user, or fixes the one already in the database, and gives it a login: the
 * authentication library (ADR-009) keeps the password in `Account`, hashed with its own function.
 * The salt is new on every run, so a rerun also resets the password to the documented one.
 */
async function ensureDemoUser(user: DemoUser, password: string) {
  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.username, displayUsername: user.username },
    create: {
      id: user.id,
      username: user.username,
      displayUsername: user.username,
      name: user.username,
      email: user.email,
      role: "USER",
    },
  });

  const hash = await hashPassword(password);
  const account = await prisma.account.findFirst({
    where: { userId: saved.id, providerId: "credential" },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hash },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: saved.id,
        providerId: "credential",
        userId: saved.id,
        password: hash,
      },
    });
  }
  return saved;
}

/** A sample review as written in prisma/data/reviews-<city>.json. `username` pins the author. */
interface SampleReview {
  rating: number;
  priceLevel: string;
  text: string;
  username?: string;
}

/**
 * Replaces the sample reviews that this seed wrote on one place, so running it again does not
 * duplicate them. A review is "ours" when it has the same place, a demo user and the same text.
 * Any other review stays, also one that someone wrote in the app while logged in as a demo user.
 *
 * Every review goes to a different demo user (nobody reviews a place twice, US-C1-01). A user who
 * already has another review on the place is skipped, and `offset` varies who writes first. A
 * review with a `username` is written by that user. Each author also gets the place marked as visited.
 */
async function replaceDemoReviews(
  placeId: string,
  demoUserIds: string[],
  userIdByUsername: Map<string, string>,
  reviews: SampleReview[],
  offset: number
) {
  await prisma.review.deleteMany({
    where: {
      placeId,
      userId: { in: demoUserIds },
      text: { in: reviews.map((review) => review.text) },
    },
  });

  const taken = new Set(
    (
      await prisma.review.findMany({
        where: { placeId },
        select: { userId: true },
      })
    ).map((review) => review.userId)
  );

  const pinned = reviews.map((review) => {
    if (!review.username) return null;
    const id = userIdByUsername.get(review.username);
    if (!id) throw new Error(`Unknown demo user: ${review.username}`);
    taken.add(id);
    return id;
  });

  const free = demoUserIds.filter((id) => !taken.has(id));
  const needed = pinned.filter((id) => id === null).length;
  if (needed > free.length) {
    throw new Error(
      `A place needs ${needed} reviewers but only ${free.length} demo users can still review it: add users to prisma/data/demo-users.json`
    );
  }
  const start = free.length === 0 ? 0 : offset % free.length;
  const rotation = [...free.slice(start), ...free.slice(0, start)];
  let next = 0;
  const authors = reviews.map((_, i) => pinned[i] ?? rotation[next++]);

  await prisma.review.createMany({
    data: reviews.map((review, i) => ({
      rating: review.rating,
      priceLevel: review.priceLevel,
      text: review.text,
      userId: authors[i],
      placeId,
    })),
  });

  // The reviews endpoint marks the place as visited for the author of a review (US-C1-01), and the seed
  // writes reviews straight into the database, so it marks the places visited too. A visit that is
  // already there stays.
  for (const userId of new Set(authors)) {
    await markPlaceVisited(prisma, userId, placeId, true);
  }
}

/**
 * Recalculates place statistics using the shared ADR-010 policy.
 * Includes reviews written directly by the seed.
 */
async function recalculateRatings() {
  const places = await prisma.place.findMany({
    where: { reviews: { some: {} } },
    select: { id: true },
  });

  for (const { id } of places) {
    await refreshPlaceStats(prisma, id);
  }

  return places.length;
}

interface RawPlace {
  osmId: string;
  name: string;
  description: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  priceLevel: string | null;
}

/** The MVP cities (US-B2-01). Their places and sample reviews are in prisma/data. */
const CITIES = [
  {
    key: "porto",
    id: "city-porto",
    name: "Porto",
    country: "Portugal",
    latitude: 41.1579,
    longitude: -8.6291,
    timezone: "Europe/Lisbon",
  },
  {
    key: "paris",
    id: "city-paris",
    name: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: "Europe/Paris",
  },
  {
    key: "berlin",
    id: "city-berlim",
    name: "Berlin",
    country: "Germany",
    latitude: 52.52,
    longitude: 13.405,
    timezone: "Europe/Berlin",
  },
];

function readJson<T>(file: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "prisma/data", file), "utf-8")
  );
}

async function main() {
  console.log("Starting PostgreSQL database seed...");

  // 1. The cities
  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { id: city.id },
      update: { timezone: city.timezone },
      create: {
        id: city.id,
        name: city.name,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
        timezone: city.timezone,
      },
    });
  }
  console.log(`Cities created: ${CITIES.map((c) => c.name).join(", ")}`);

  // 2. Create Demo Users, with a password they can log in with (US-B2-01)
  const password = demoPassword();
  const demoUserIds: string[] = [];
  const userIdByUsername = new Map<string, string>();
  for (const user of DEMO_USERS) {
    const saved = await ensureDemoUser(user, password);
    demoUserIds.push(saved.id);
    userIdByUsername.set(user.username, saved.id);
  }
  console.log(
    `${DEMO_USERS.length} demo users created (they log in with the demo password)`
  );

  for (const city of CITIES) {
    // 3. The places of the city: the snapshot written by `npm run import:osm`
    const placesData = readJson<RawPlace[]>(`${city.key}-places.json`);

    // The price level of a place with reviews comes from its reviews: the snapshot does not touch it
    const reviewed = new Set(
      (
        await prisma.place.findMany({
          where: {
            osmId: { in: placesData.map((p) => p.osmId) },
            reviews: { some: {} },
          },
          select: { osmId: true },
        })
      ).map((place) => place.osmId)
    );

    for (const p of placesData) {
      const category =
        (PlaceCategory as Record<string, PlaceCategory>)[p.category] ||
        PlaceCategory.OTHER;
      const fields = {
        name: p.name,
        description: p.description,
        category,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        openingHours: p.openingHours,
        cityId: city.id,
      };
      await prisma.place.upsert({
        where: { osmId: p.osmId },
        update: {
          ...fields,
          ...(reviewed.has(p.osmId) ? {} : { priceLevel: p.priceLevel }),
        },
        create: {
          ...fields,
          osmId: p.osmId,
          priceLevel: p.priceLevel,
          source: "IMPORTED",
        },
      });
    }
    console.log(
      `${placesData.length} OpenStreetMap places imported for ${city.name}!`
    );

    // 4. The sample reviews of the city, each on a place of the snapshot
    const samples = readJson<
      { osmId: string; name: string; reviews: SampleReview[] }[]
    >(`reviews-${city.key}.json`);
    let written = 0;
    for (const [index, sample] of samples.entries()) {
      const place = await prisma.place.findUnique({
        where: { osmId: sample.osmId },
        select: { id: true },
      });
      if (!place) {
        throw new Error(
          `${sample.name} (${sample.osmId}) has sample reviews but is not in the snapshot of ${city.name}`
        );
      }
      await replaceDemoReviews(
        place.id,
        demoUserIds,
        userIdByUsername,
        sample.reviews,
        index
      );
      written += sample.reviews.length;
    }
    console.log(
      `${written} sample reviews written on ${samples.length} places of ${city.name}.`
    );
  }

  // 5. The stored ratings and price levels must match the reviews
  const rated = await recalculateRatings();
  console.log(`Ratings recalculated for ${rated} places with reviews.`);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
