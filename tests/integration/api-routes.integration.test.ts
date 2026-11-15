import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getPlaces } from "@/app/api/places/route";

describe("API Integration Tests (Real Postgres)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET /api/health returns 200 with service status", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("Tripbook Next.js Fullstack API");
  });

  it("GET /api/places returns places from database", async () => {
    const req = new Request("http://localhost:3000/api/places?city=Porto");
    const res = await getPlaces(req);
    expect(res.status).toBe(200);
    const places = await res.json();
    expect(Array.isArray(places)).toBe(true);
  });
});
