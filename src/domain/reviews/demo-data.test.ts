import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { isPriceLevel } from "./rating";

/**
 * The demo data of the seed (US-B2-01): the places of the three MVP cities, their sample reviews and
 * the demo users, all in prisma/data. These tests keep the data consistent, so a bad edit fails here
 * and not in the middle of a seed run.
 */

// city, and how many places must have sample reviews
const CITIES: [string, number][] = [
  ["porto", 100],
  ["paris", 100],
  ["berlin", 100],
];

function readJson<T>(file: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "prisma/data", file), "utf-8")
  );
}

interface Place {
  osmId: string;
  name: string;
  priceLevel: string | null;
}
interface Review {
  rating: number;
  priceLevel: string;
  text: string;
  username?: string;
}
interface Sample {
  osmId: string;
  name: string;
  reviews: Review[];
}

const users =
  readJson<{ id: string; username: string; email: string }[]>(
    "demo-users.json"
  );

describe("demo users", () => {
  it("have unique ids, usernames and e-mails", () => {
    for (const key of ["id", "username", "email"] as const) {
      const values = users.map((user) => user[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});

describe.each(CITIES)("demo data of %s", (city, minReviewed) => {
  const places = readJson<Place[]>(`${city}-places.json`);
  const samples = readJson<Sample[]>(`reviews-${city}.json`);
  const byOsmId = new Map(places.map((place) => [place.osmId, place]));

  it("has places with unique OpenStreetMap ids", () => {
    expect(places.length).toBeGreaterThan(100);
    expect(byOsmId.size).toBe(places.length);
  });

  it("never guesses a price level: a place is FREE or unknown", () => {
    for (const place of places) {
      expect([null, "FREE"]).toContain(place.priceLevel);
    }
  });

  it("has sample reviews for enough places, each on a place of the snapshot, once", () => {
    expect(samples.length).toBeGreaterThanOrEqual(minReviewed);
    const ids = samples.map((sample) => sample.osmId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sample of samples) {
      expect(byOsmId.has(sample.osmId), sample.name).toBe(true);
    }
  });

  it("has valid reviews: rating 1 to 5, a price level, a text, no repeated text on a place", () => {
    for (const sample of samples) {
      expect(sample.reviews.length, sample.name).toBeGreaterThan(0);
      const texts = sample.reviews.map((review) => review.text);
      expect(new Set(texts).size, sample.name).toBe(texts.length);
      for (const review of sample.reviews) {
        expect(Number.isInteger(review.rating), sample.name).toBe(true);
        expect(review.rating).toBeGreaterThanOrEqual(1);
        expect(review.rating).toBeLessThanOrEqual(5);
        expect(isPriceLevel(review.priceLevel), sample.name).toBe(true);
        expect(review.text.trim(), sample.name).not.toBe("");
      }
    }
  });

  it("needs no more reviewers than there are demo users, and its pinned authors exist", () => {
    const usernames = new Set(users.map((user) => user.username));
    for (const sample of samples) {
      expect(sample.reviews.length, sample.name).toBeLessThanOrEqual(
        users.length
      );
      const pinned = sample.reviews
        .map((review) => review.username)
        .filter((name): name is string => Boolean(name));
      expect(new Set(pinned).size, sample.name).toBe(pinned.length);
      for (const name of pinned) expect(usernames.has(name)).toBe(true);
    }
  });

  it("shows the rating score at work: places with 1 review and places with 20 or more", () => {
    const counts = samples.map((sample) => sample.reviews.length);
    expect(Math.min(...counts)).toBe(1);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(20);
  });
});

describe("the hand-written Meh review", () => {
  it("is kept, with a price level, on the real Serralves place of Porto", () => {
    const samples = readJson<Sample[]>("reviews-porto.json");
    const meh = samples
      .flatMap((sample) => sample.reviews)
      .filter((review) => review.text === "Meh");
    expect(meh).toHaveLength(1);
    expect(isPriceLevel(meh[0].priceLevel)).toBe(true);
    expect(meh[0].username).toBe("viajante_porto");
  });
});
