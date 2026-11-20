"use client";

/**
 * The saved places of the person next to the itinerary, each with a button that adds it to the day
 * chosen in the planner. Only the places of the city of the trip can be added.
 */

import { Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedPlaces } from "@/components/SavedPlacesProvider";
import { getCategoryConfig } from "@/domain/catalog/categories";
import {
  formatAverageRating,
  formatReviewCount,
} from "@/domain/catalog/place-details";
import { plannerSavedPlaces } from "@/domain/itinerary/itinerary-editor";
import { SAVED_PLACE_LABELS } from "@/domain/saved-places/saved-places";

interface PlannerSavedPlacesProps {
  cityName: string;
  cityPlaceIds: ReadonlySet<string>;
  plannedIds: ReadonlySet<string>;
  dayLabel: string;
  disabled: boolean;
  onAdd: (placeId: string) => void;
}

export default function PlannerSavedPlaces({
  cityName,
  cityPlaceIds,
  plannedIds,
  dayLabel,
  disabled,
  onAdd,
}: PlannerSavedPlacesProps) {
  const savedPlaces = useSavedPlaces();

  if (!savedPlaces) return null;

  const { sections, elsewhere } = plannerSavedPlaces(
    savedPlaces.saved,
    cityPlaceIds
  );

  return (
    <section
      aria-labelledby="planner-saved-heading"
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id="planner-saved-heading" className="font-semibold">
        Your saved places in {cityName}
      </h2>

      {savedPlaces.status === "loading" && (
        <p className="text-sm text-slate-500">Loading your saved places…</p>
      )}
      {savedPlaces.status === "error" && (
        <p role="alert" className="text-sm text-rose-700">
          Your saved places could not be loaded.{" "}
          <button
            type="button"
            onClick={() => void savedPlaces.reload()}
            className="underline"
          >
            Try again
          </button>
        </p>
      )}

      {savedPlaces.status === "ready" &&
        (["WISHLIST", "BOOKMARK"] as const).map((type) => (
          <div key={type}>
            <h3 className="mb-1 text-sm font-medium text-slate-700">
              {SAVED_PLACE_LABELS[type].section}
            </h3>
            {sections[type].length === 0 ? (
              <p className="text-sm text-slate-500">
                {SAVED_PLACE_LABELS[type].empty}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {sections[type].map(({ place }) => (
                  <li
                    key={place.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {place.name}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                        <Star
                          aria-hidden
                          className="h-3 w-3 fill-amber-500 text-amber-500"
                        />
                        {formatAverageRating(place.averageRating)} ·{" "}
                        {formatReviewCount(place.reviewCount ?? 0)} ·{" "}
                        {getCategoryConfig(place.category).label}
                      </p>
                    </div>
                    {plannedIds.has(place.id) ? (
                      <span className="text-xs text-slate-500">Planned</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => onAdd(place.id)}
                        aria-label={`Add ${place.name} to ${dayLabel}`}
                      >
                        <Plus />
                        {dayLabel}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

      {savedPlaces.status === "ready" && elsewhere > 0 && (
        <p className="text-xs text-slate-500">
          {elsewhere === 1
            ? "1 saved place is in another city."
            : `${elsewhere} saved places are in other cities.`}
        </p>
      )}
    </section>
  );
}
