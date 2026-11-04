import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Not-found page shown when a place id does not exist in the catalog (AC5, #29).
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Place not found
      </h1>

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        This place is not in the catalog.
      </p>

      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to places
        </Link>
      </div>
    </div>
  );
}
