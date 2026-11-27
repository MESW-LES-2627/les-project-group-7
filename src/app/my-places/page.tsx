import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SavedPlacesProvider from "@/components/SavedPlacesProvider";
import MyPlacesView from "@/components/MyPlacesView";

export const dynamic = "force-dynamic";

export default async function MyPlacesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Saved
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Places you want to go to, and places you want to remember.
        </p>
      </div>

      <SavedPlacesProvider loggedIn>
        <MyPlacesView />
      </SavedPlacesProvider>
    </main>
  );
}
