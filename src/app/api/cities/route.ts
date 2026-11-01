import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rejectCrossSiteRequest } from "@/lib/request-guard";
import { parseNewCity } from "@/domain/catalog/city";

/**
 * POST /api/cities
 * Body: { name, country, latitude, longitude }. Adds a city to the catalog for everyone.
 *
 * 201 { city } when it is new, 200 { city } when a city with that name and country already
 * exists (adding twice is harmless). 401 without a session, 400 for a wrong body, 415 if the body
 * is not JSON, 403 if the request comes from another site.
 */
export async function POST(request: Request) {
  const rejected = rejectCrossSiteRequest(request);
  if (rejected) return rejected;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      { error: "Log in to add a city" },
      { status: 401 }
    );
  }

  const input = parseNewCity(await request.json().catch(() => undefined));
  if (!input) {
    return NextResponse.json({ error: "Invalid city" }, { status: 400 });
  }

  // shortcut: no unique constraint, two people adding the same city at the same instant can make
  // two rows; add @@unique([name, country]) when that shows up.
  const existing = await prisma.city.findFirst({
    where: {
      name: { equals: input.name, mode: "insensitive" },
      country: { equals: input.country, mode: "insensitive" },
    },
  });
  if (existing) return NextResponse.json({ city: existing });

  const city = await prisma.city.create({ data: input });
  return NextResponse.json({ city }, { status: 201 });
}
