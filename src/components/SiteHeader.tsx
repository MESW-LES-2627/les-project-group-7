import Link from "next/link";
import { headers } from "next/headers";
import { Compass } from "lucide-react";
import { auth } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Top bar on every page. Logged out: links to the login and registration pages.
 * Logged in: links to "My trips", "Saved" (the saved places) and "History" (the places visited), the username as typed, and the logout button.
 */
export default async function SiteHeader() {
  // A database failure must not take down every page (404s, /register): show the logged-out bar.
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch((error) => {
      console.error("getSession failed:", error);
      return null;
    });

  return (
    <nav className="border-b border-slate-200 bg-white">
      {/* Full width, with the same side space as the pages that fill the screen (#187) */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600"
        >
          <Compass className="h-4 w-4" />
          Tripbook
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {session ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/trips"
                className="rounded text-sm font-medium text-slate-700 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:hover:text-indigo-400"
              >
                My trips
              </Link>
              <Link
                href="/my-places"
                className="rounded text-sm font-medium text-slate-700 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:hover:text-indigo-400"
              >
                Saved
              </Link>
              <Link
                href="/visited"
                className="rounded text-sm font-medium text-slate-700 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 dark:hover:text-indigo-400"
              >
                History
              </Link>
              {/* Only for screen readers below sm: with the username the header is wider than a 390 px phone. */}
              <span className="sr-only text-sm font-medium text-slate-700 sm:not-sr-only">
                @{session.user.displayUsername ?? session.user.username}
              </span>
              <LogoutButton />
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
