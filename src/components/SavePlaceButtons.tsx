"use client";

/**
 * The wishlist and bookmark buttons of a place. Each one shows if the place is saved
 * with that type and saves or removes it on click. Logged out, they link to the
 * login page instead.
 */

import Link from "next/link";
import { Bookmark, Heart, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SAVED_PLACE_LABELS,
  type SavedPlaceSummary,
  type SavedPlaceType,
} from "@/domain/saved-places/saved-places";
import { useSavedPlaces } from "./SavedPlacesProvider";

const ICONS: Record<SavedPlaceType, LucideIcon> = {
  WISHLIST: Heart,
  BOOKMARK: Bookmark,
};

const SAVED_ICON: Record<SavedPlaceType, string> = {
  WISHLIST: "fill-rose-500 text-rose-500",
  BOOKMARK: "fill-indigo-500 text-indigo-500",
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1";

interface SavePlaceButtonsProps {
  place: SavedPlaceSummary & { isDiscovered?: boolean };
  /** `full`: icon and words, for the place page. `compact`: icon only, for lists, cards and the map. */
  variant?: "full" | "compact";
  className?: string;
}

export default function SavePlaceButtons({
  place,
  variant = "compact",
  className,
}: SavePlaceButtonsProps) {
  const savedPlaces = useSavedPlaces();

  if (!savedPlaces || place.isDiscovered) {
    return null;
  }

  const compact = variant === "compact";
  const base = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    FOCUS,
    compact ? "h-7 w-7" : "h-9 px-3 text-sm"
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {(["WISHLIST", "BOOKMARK"] as const).map((type) => {
        const Icon = ICONS[type];
        const labels = SAVED_PLACE_LABELS[type];

        if (savedPlaces.status === "logged-out") {
          return (
            <Link
              key={type}
              href="/login"
              aria-label={`Log in to ${labels.add.toLowerCase()}`}
              title="Log in to save places"
              className={cn(
                base,
                "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {!compact && labels.add}
            </Link>
          );
        }

        const saved = savedPlaces.isSaved(place.id, type);
        const pending = savedPlaces.isPending(place.id, type);
        const action = saved ? labels.remove : labels.add;
        const unavailable = savedPlaces.status !== "ready";

        return (
          <button
            key={type}
            type="button"
            aria-pressed={saved}
            aria-label={compact ? `${action}: ${place.name}` : undefined}
            title={unavailable ? "Saved places are not loaded" : action}
            disabled={unavailable || pending}
            onClick={() => void savedPlaces.toggle(place, type)}
            className={cn(
              base,
              saved
                ? "border-slate-300 bg-slate-100 text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <Icon
              className={cn("h-3.5 w-3.5", saved && SAVED_ICON[type])}
              aria-hidden="true"
            />
            {!compact && (saved ? labels.saved : labels.add)}
          </button>
        );
      })}
    </div>
  );
}
