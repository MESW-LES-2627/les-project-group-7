import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlaceExplorer from "@/components/PlaceExplorer";
import CreateTripDialog from "@/components/CreateTripDialog";

// Ensure fresh data is fetched from the database on every request
export const dynamic = "force-dynamic";

/**
 * Main Page Server Component (Tracer Bullet / Iteration 0).
 *
 * Queries places and cities directly from PostgreSQL via Prisma ORM and renders
 * the interactive client explorer with OpenStreetMap points of interest.
 */
export default async function Home() {
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

  // A database failure must not take down the page: treat the visitor as logged out.
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch((error) => {
      console.error("getSession failed:", error);
      return null;
    });
  const currentUsername = session
    ? (session.user.displayUsername ?? session.user.username ?? null)
    : null;

  // Places the logged-in user has visited (a visit is saved with each review)
  const visits = session
    ? await prisma.visit.findMany({
        where: { userId: session.user.id },
        select: { placeId: true },
      })
    : [];
  const visitedPlaceIds = new Set(visits.map((visit) => visit.placeId));

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
    isVisited: visitedPlaceIds.has(place.id),
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
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-prose text-slate-600">
            Pick a city and your dates, then build your itinerary day by day.
          </p>
          <CreateTripDialog cities={cities} loggedIn={session !== null} />
        </div>

        <PlaceExplorer
          initialPlaces={places}
          initialCities={cities}
          currentUsername={currentUsername}
        />
      </main>
    </div>
  );
}
