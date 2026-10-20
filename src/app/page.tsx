import { Database, Compass } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PlaceExplorer from "@/components/PlaceExplorer";

// Ensure fresh data is fetched from the database on every request
export const dynamic = "force-dynamic";

/**
 * Main Page Server Component (Tracer Bullet / Iteration 0).
 * 
 * Queries places directly from PostgreSQL via Prisma ORM and renders
 * the interactive client explorer with OpenStreetMap points of interest.
 */
export default async function Home() {
  // 1. Fetch all places persisted in the database including city details
  const dbPlaces = await prisma.place.findMany({
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

  // 2. Map to the clean interface expected by the UI component
  const places = dbPlaces.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    priceLevel: p.priceLevel,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    city: p.city,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Application header with stack and infrastructure status */}
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 text-indigo-600 font-bold text-sm tracking-wide uppercase mb-2">
          <Compass className="w-5 h-5" />
          Tripbook · Iteration 0
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Explore & Rate Spots
        </h1>

        <p className="mt-2 text-base text-slate-600 max-w-2xl mx-auto">
          Place reviews with dummy users, dynamic average rating calculation, and interactive OSM map connected to PostgreSQL.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          PostgreSQL Docker (5432) + Prisma ORM Connected
        </div>
      </header>

      {/* Interactive Explorer (Map + Spots Grid + Review Modal) */}
      <main>
        <PlaceExplorer initialPlaces={places} />
      </main>
    </div>
  );
}
