import { Compass } from "lucide-react";
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
  const places = dbPlaces.map((place) => ({
    id: place.id,
    name: place.name,
    description: place.description,
    category: place.category,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    priceLevel: place.priceLevel,
    averageRating: place.averageRating,
    reviewCount: place.reviewCount,
    city: place.city,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-xs tracking-wider uppercase mb-2">
          <Compass className="w-4 h-4" />
          Tripbook
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Explore & Rate Places
        </h1>

        <p className="mt-3 text-base text-slate-600 max-w-xl mx-auto">
          Discover top attractions across Porto, explore community ratings, and share your reviews.
        </p>
      </header>

      <main>
        <PlaceExplorer initialPlaces={places} />
      </main>
    </div>
  );
}
