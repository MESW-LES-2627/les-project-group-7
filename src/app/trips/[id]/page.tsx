import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toTripResponse } from "@/domain/trips/trip-response";
import { formatDayLabel } from "@/domain/trips/trip-labels";
import DeleteTripDialog from "@/components/DeleteTripDialog";
import EditTripDialog from "@/components/EditTripDialog";

export const dynamic = "force-dynamic";

interface TripPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPage({ params }: TripPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  // A trip of someone else is a 404, the same as a missing one, so nothing leaks.
  const record = await prisma.trip.findFirst({
    where: { id, userId: session.user.id },
    include: {
      days: true,
      itinerary: true,
      city: { select: { name: true, country: true } },
    },
  });
  // A trip is always created with its itinerary; the check also narrows the optional relation.
  const itinerary = record?.itinerary;
  if (!record || !itinerary) notFound();

  const trip = toTripResponse({ ...record, itinerary });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p className="mb-6 text-sm text-slate-600">
            {record.city.name}, {record.city.country} · {trip.startDate} to{" "}
            {trip.endDate}
          </p>
        </div>

        <div className="flex gap-2">
          <EditTripDialog
            tripId={trip.id}
            name={trip.name}
            startDate={trip.startDate}
            endDate={trip.endDate}
          />
          <DeleteTripDialog tripId={trip.id} tripName={trip.name} />
        </div>
      </div>

      <ul className="space-y-3">
        {trip.days.map((day) => (
          <li key={day.id} className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-semibold">
              {formatDayLabel(day.dayNumber, day.date)}
            </h2>
            <p className="text-sm text-slate-500">No places yet</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
