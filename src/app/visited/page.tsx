import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategoryConfig } from "@/domain/catalog/categories";
import FilterLinks from "@/components/FilterLinks";
import PageLinks from "@/components/PageLinks";
import { placeLocation } from "@/domain/catalog/place-location";
import {
  citiesWithVisits,
  historyHref,
  historyView,
  type CityCount,
} from "@/domain/visits/history";

export const dynamic = "force-dynamic";

/**
 * History, the record of the places visited (Task #43; named "My visited places" until #187).
 *
 * Shows the authenticated user's visited places, newest first, 24 per page, with a filter by city
 * (#187). Visits remain visible even if their reviews are deleted.
 */
export default async function VisitedPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;

  // How many of the person's places are in each city: the buttons of the filter and the number of pages
  const cityRows = await prisma.city.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: { places: { where: { visits: { some: { userId } } } } },
      },
    },
  });
  const cities: CityCount[] = cityRows.map((city) => ({
    id: city.id,
    name: city.name,
    count: city._count.places,
  }));
  const filterCities = citiesWithVisits(cities);
  const view = historyView(await searchParams, cities);

  const visits = await prisma.visit.findMany({
    where: view.cityId
      ? { userId, place: { cityId: view.cityId } }
      : { userId },
    skip: view.skip,
    take: view.take,
    select: {
      placeId: true,
      visitedAt: true,
      place: {
        select: {
          id: true,
          name: true,
          category: true,
          address: true,
          city: {
            select: {
              name: true,
              country: true,
            },
          },
          reviews: {
            where: { userId },
            select: {
              rating: true,
            },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ visitedAt: "desc" }, { placeId: "asc" }],
  });

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          History
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Places you have visited, starting with the most recent.
        </p>
      </div>

      <FilterLinks
        options={filterCities}
        selectedId={view.cityId}
        hrefFor={(cityId) => historyHref(cityId)}
        label="Filter by city"
        allLabel="All cities"
      />

      {visits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <h2 className="text-lg font-medium text-slate-900">
            Nothing in your history yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            A place appears here when you post a review of it. Find one on the
            map or in the ranking and rate it.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Explore places
          </Link>
        </div>
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          role="list"
        >
          {visits.map((visit) => {
            const place = visit.place;
            const rating = place.reviews[0]?.rating ?? null;
            const category = getCategoryConfig(place.category);

            return (
              <li key={visit.placeId} className="min-w-0">
                <Link
                  href={`/places/${place.id}`}
                  className="group block h-full rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-semibold text-slate-900 group-hover:text-indigo-600">
                        {place.name}
                      </h2>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {category.label}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 text-sm font-medium text-slate-700">
                      <Star
                        className="h-4 w-4 text-amber-500"
                        aria-hidden="true"
                      />
                      <span>
                        {rating !== null ? `${rating}/5` : "Not rated"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>
                      {placeLocation(
                        place.address,
                        place.city.name,
                        place.city.country
                      )}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>
                      Visited on{" "}
                      <time dateTime={visit.visitedAt.toISOString()}>
                        {visit.visitedAt.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </time>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* The same controls as the ranking of the home page (#187, AC4) */}
      <PageLinks
        view={view}
        hrefFor={(page) => historyHref(view.cityId, page)}
        noun="places"
        label="Pages of your history"
      />
    </main>
  );
}
