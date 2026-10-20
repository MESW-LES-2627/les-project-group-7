import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/places
 * Queries and filters the catalog of places persisted in PostgreSQL.
 * Supports optional `city` and `category` query parameters.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cityQuery = searchParams.get("city");
    const category = searchParams.get("category");

    // Dynamic Prisma where clause
    const whereClause: Record<string, unknown> = {};

    // Filter by city
    if (cityQuery) {
      whereClause.city = {
        name: {
          contains: cityQuery,
          mode: "insensitive",
        },
      };
    }

    // Filter by category enum
    if (category) {
      whereClause.category = category;
    }

    // Query database
    const places = await prisma.place.findMany({
      where: whereClause,
      include: {
        city: {
          select: {
            name: true,
            country: true,
          },
        },
      },
      orderBy: [
        { averageRating: "desc" },
        { name: "asc" },
      ],
    });

    return NextResponse.json(places);
  } catch (error) {
    console.error("Failed to fetch places:", error);

    return NextResponse.json(
      { error: "Failed to fetch places from database" },
      { status: 500 }
    );
  }
}
