import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlaceExplorer from "@/components/PlaceExplorer";

// Ensure fresh data is fetched from the database on every request
export const dynamic = "force-dynamic";

/**
 * Main Page Server Component (Tracer Bullet / Iteration 0).
 *
 * Queries places and cities directly from PostgreSQL via Prisma ORM and renders
 * the interactive client explorer with OpenStreetMap points of interest.
 */
export default async function Home() {
  // Adding a city needs a session, so the explorer hides the button without one.
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  // 1. Fetch all places persisted in the database including city details
  const dbPlaces = await prisma.place.findMany({
    include: {
      city: {
        select: {
          id: true,
          name: true,
          country: true,
        },
      },
    },
    orderBy: [{ averageRating: "desc" }, { name: "asc" }],
  });

  // 2. Fetch European cities with spot counts for dynamic navigation
  const dbCities = await prisma.city.findMany({
    include: {
      _count: {
        select: { places: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // 3. Map to the clean interface expected by the UI component
  const places = dbPlaces.map((place) => ({
    id: place.id,
    cityId: place.cityId,
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

  const cities = dbCities.map((city) => ({
    id: city.id,
    name: city.name,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
    count: city._count.places,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <main>
        <PlaceExplorer
          initialPlaces={places}
          initialCities={cities}
          isLoggedIn={!!session}
        />
      </main>
    </div>
  );
}
