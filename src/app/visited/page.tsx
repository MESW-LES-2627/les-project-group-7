import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, MapPin, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCategoryConfig } from "@/domain/catalog/categories";

export const dynamic = "force-dynamic";

/**
 * My visited places page (Task #43).
 *
 * Shows the authenticated user's visited places, newest first.
 * Visits remain visible even if their reviews are deleted.
 */
export default async function VisitedPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;

  const visits = await prisma.visit.findMany({
    where: { userId },
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
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My visited places
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Places you have visited, starting with the most recent.
        </p>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <h2 className="text-lg font-medium text-slate-900">
            No visited places yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            You have not visited any places yet. Explore places and share your
            experiences.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Explore places
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
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
                      {place.address} — {place.city.name}, {place.city.country}
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
    </main>
  );
}
