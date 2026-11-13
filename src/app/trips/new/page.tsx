import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import TripForm from "@/components/TripForm";

export const dynamic = "force-dynamic";

export default async function NewTripPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const cities = await prisma.city.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, country: true },
  });

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create a trip</h1>

      {/* Without cities the form could never succeed, so say why instead of showing it. */}
      {cities.length === 0 ? (
        <p className="text-sm text-slate-600">
          No cities are available yet, so a trip cannot be created.
        </p>
      ) : (
        <TripForm cities={cities} />
      )}
    </main>
  );
}
