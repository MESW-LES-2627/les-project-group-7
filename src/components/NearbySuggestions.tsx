"use client";

/**
 * The best places near a stop of the itinerary (US-E5-01, #64): best rated first, each with its distance
 * and walking time, and a button that adds it to the day of the stop. The ranking is nearbyPlaces (#63),
 * this component only chooses the type and shows the result.
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_CONFIGS,
  getCategoryConfig,
} from "@/domain/catalog/categories";
import { nearbyPlaces, formatDistance } from "@/domain/catalog/nearby";
import {
  formatAverageRating,
  formatReviewCount,
} from "@/domain/catalog/place-details";
import type { PlaceItem } from "@/types/place";

interface NearbySuggestionsProps {
  originName: string;
  origin: { latitude: number; longitude: number };
  places: readonly PlaceItem[];
  plannedIds: ReadonlySet<string>;
  dayLabel: string;
  disabled: boolean;
  onAdd: (placeId: string) => void;
}

/** Places on each page of the panel: near a city centre there can be hundreds within 1 km. */
const PAGE_SIZE = 10;

/** The id of the type filter: the planner moves the focus here when the panel opens. */
export const NEARBY_TYPE_FILTER_ID = "nearby-type";

export default function NearbySuggestions({
  originName,
  origin,
  places,
  plannedIds,
  dayLabel,
  disabled,
  onAdd,
}: NearbySuggestionsProps) {
  const [category, setCategory] = useState<PlaceItem["category"] | null>(null);
  const [page, setPage] = useState(1);

  const { radiusKm, suggestions } = nearbyPlaces(origin, places, {
    category,
    excludeIds: plannedIds,
  });
  const types = (
    Object.keys(CATEGORY_CONFIGS) as PlaceItem["category"][]
  ).filter((type) => places.some((place) => place.category === type));
  const count = suggestions.length;
  // Adding a place makes the list shorter: when that empties the last page, the one before is shown
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const shownPage = Math.min(page, totalPages);
  const firstShown = (shownPage - 1) * PAGE_SIZE;
  const shown = suggestions.slice(firstShown, firstShown + PAGE_SIZE);

  return (
    <section
      aria-labelledby="nearby-heading"
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id="nearby-heading" className="font-semibold">
        Near {originName}
      </h2>

      <div className="space-y-1">
        <Label htmlFor={NEARBY_TYPE_FILTER_ID}>Type</Label>
        <select
          id={NEARBY_TYPE_FILTER_ID}
          value={category ?? ""}
          onChange={(event) => {
            setCategory(
              types.find((type) => type === event.target.value) ?? null
            );
            setPage(1);
          }}
          className="shadow-xs h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 sm:w-56"
        >
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {getCategoryConfig(type).label}
            </option>
          ))}
        </select>
      </div>

      {/* Seen by everyone when there are places; with none, the message below says it already */}
      <p
        role="status"
        className={count === 0 ? "sr-only" : "text-xs text-slate-500"}
      >
        {count === 0
          ? `No places near ${originName}`
          : `${count === 1 ? "1 place" : `${count} places`} near ${originName}`}
      </p>

      {count === 0 ? (
        <p className="text-sm text-slate-500">
          {category === null
            ? `No places within 2 km of ${originName}.`
            : `No places of this type within 2 km of ${originName}. Try another type.`}
        </p>
      ) : (
        <>
          {radiusKm === 2 && (
            <p className="text-xs text-slate-500">
              Fewer than 3 places within 1 km, so this shows places up to 2 km.
            </p>
          )}
          <ul className="space-y-1.5">
            {shown.map(({ place, distanceKm, walkingMinutes, score }) => {
              const config = getCategoryConfig(place.category);

              return (
                <li
                  key={place.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium">
                      {place.name}
                    </h3>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                      <Star
                        aria-hidden
                        className="h-3 w-3 fill-amber-500 text-amber-500"
                      />
                      <span className="sr-only">Rating:</span>
                      <span>{formatAverageRating(place.averageRating)}</span>
                      {score !== null && (
                        <>
                          {" · "}
                          <span>{formatReviewCount(place.reviewCount)}</span>
                        </>
                      )}
                      {" · "}
                      <span className={config.textColor}>{config.label}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatDistance(distanceKm)} · {walkingMinutes} min walk
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onAdd(place.id)}
                    aria-label={`Add to ${dayLabel} (${place.name})`}
                  >
                    <Plus />
                    Add to {dayLabel}
                  </Button>
                </li>
              );
            })}
          </ul>

          {/* The look of the pages of the home ranking. Previous and Next stay focusable on the first
              and the last page (aria-disabled), so the focus is not lost there. */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:flex-row">
              <span className="text-xs text-slate-500">
                Showing {firstShown + 1} to {firstShown + shown.length} of{" "}
                {count} places
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Previous page"
                  aria-disabled={shownPage <= 1 || undefined}
                  onClick={() => {
                    if (shownPage > 1) setPage(shownPage - 1);
                  }}
                  className="h-8 gap-1 text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <span className="px-2 text-xs font-medium text-slate-700">
                  Page {shownPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Next page"
                  aria-disabled={shownPage >= totalPages || undefined}
                  onClick={() => {
                    if (shownPage < totalPages) setPage(shownPage + 1);
                  }}
                  className="h-8 gap-1 text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
