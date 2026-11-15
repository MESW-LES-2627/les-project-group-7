import Link from "next/link";
import { headers } from "next/headers";
import { Compass } from "lucide-react";
import { auth } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Top bar on every page. Logged out: links to the login and registration pages.
 * Logged in: link to "My trips", the username as typed, and the logout button.
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
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
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
            <div className="flex items-center gap-4">
              <Link
                href="/trips"
                className="rounded text-sm font-medium text-slate-700 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                My trips
              </Link>
              <span className="text-sm font-medium text-slate-700">
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
