import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toTripResponse } from "@/domain/trips/trip-response";
import { toStopResponse } from "@/domain/itinerary/stop-response";
import { listStops } from "@/lib/trip-stops";
import DeleteTripDialog from "@/components/DeleteTripDialog";
import ItineraryEditor from "@/components/ItineraryEditor";

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

  const [stops, cityPlaces] = await Promise.all([
    listStops(prisma, itinerary.id),
    prisma.place.findMany({
      where: { cityId: record.cityId },
      select: {
        id: true,
        osmId: true,
        name: true,
        category: true,
        address: true,
        latitude: true,
        longitude: true,
        priceLevel: true,
        averageRating: true,
        reviewCount: true,
      },
      orderBy: [
        { averageRating: { sort: "desc", nulls: "last" } },
        { name: "asc" },
      ],
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <p className="mb-6 text-sm text-slate-600">
            {record.city.name}, {record.city.country} · {trip.startDate} to{" "}
            {trip.endDate}
          </p>
        </div>

        <DeleteTripDialog tripId={trip.id} tripName={trip.name} />
      </div>

      <ItineraryEditor
        tripId={trip.id}
        cityName={record.city.name}
        days={trip.days}
        initialStops={stops.map(toStopResponse)}
        cityPlaces={cityPlaces}
      />
    </main>
  );
}
