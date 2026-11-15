import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/domain/trips/trip-days";
import {
  formatTripDateRange,
  formatTripDuration,
} from "@/domain/trips/trip-labels";
import CreateTripDialog from "@/components/CreateTripDialog";

export const dynamic = "force-dynamic";

/**
 * My Trips page (US-E1-01, AC6, #9).
 *
 * Displays all trips planned by the authenticated user.
 * Other users' trips are never visible. Redirects to /login when unauthenticated.
 */
export default async function MyTripsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [trips, dbCities] = await Promise.all([
    prisma.trip.findMany({
      where: { userId: session.user.id },
      include: {
        city: { select: { id: true, name: true, country: true } },
        days: { select: { id: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.city.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, country: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My trips
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pick a trip to view its itinerary and places.
          </p>
        </div>
        <CreateTripDialog cities={dbCities} loggedIn={true} />
      </div>

      {trips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <h2 className="text-lg font-medium text-slate-900">No trips yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            You have not planned any trips yet. Start by planning your first
            adventure.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" role="list">
          {trips.map((trip) => {
            const startStr = formatDateOnly(trip.startDate);
            const endStr = formatDateOnly(trip.endDate);
            return (
              <li key={trip.id} className="min-w-0">
                <Link
                  href={`/trips/${trip.id}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  <h2 className="break-words text-lg font-semibold text-slate-900 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {trip.name}
                  </h2>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin
                      className="h-4 w-4 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>
                      {trip.city.name}, {trip.city.country}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar
                        className="h-3.5 w-3.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <span>{formatTripDateRange(startStr, endStr)}</span>
                    </div>
                    <span className="font-medium text-slate-600">
                      {formatTripDuration(trip.days.length)}
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
