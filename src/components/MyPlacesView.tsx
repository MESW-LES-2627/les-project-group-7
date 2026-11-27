"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bookmark, Heart, Loader2, MapPin, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { formatAverageRating } from "@/domain/catalog/place-details";
import { chosenCityId, defaultCityId } from "@/domain/catalog/city-filter";
import { placeLocation } from "@/domain/catalog/place-location";
import CityFilter from "./CityFilter";
import {
  SAVED_PLACE_LABELS,
  SAVED_PLACE_TYPES,
  savedCityCounts,
  savedInCity,
  savedSections,
  type SavedPlace,
  type SavedPlaceType,
} from "@/domain/saved-places/saved-places";
import { useSavedPlaces } from "./SavedPlacesProvider";

const SECTION_ICONS: Record<SavedPlaceType, typeof Heart> = {
  WISHLIST: Heart,
  BOOKMARK: Bookmark,
};

/** The city Saved opens on, when the person has saved places there; Tripbook starts from Porto. */
const DEFAULT_CITY_ID = "city-porto";

/** The address of the Saved page with a city chosen, or all cities for null. */
function savedHref(cityId: string | null): string {
  return cityId
    ? `/my-places?${new URLSearchParams({ city: cityId })}`
    : "/my-places";
}

export default function MyPlacesView() {
  const savedPlaces = useSavedPlaces();
  const searchParams = useSearchParams();

  if (!savedPlaces || savedPlaces.status === "logged-out") {
    return null;
  }

  if (savedPlaces.status === "loading") {
    return (
      <p
        role="status"
        className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading your saved places…
      </p>
    );
  }

  if (savedPlaces.status === "error") {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
        <p className="text-sm text-slate-600">
          Your saved places could not be loaded.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void savedPlaces.reload()}
        >
          Try again
        </Button>
      </div>
    );
  }

  // The filter by city (#187): the places are all loaded, so it filters here, with no request
  const cities = savedCityCounts(savedPlaces.saved);
  // Always one city, no "All cities": the one of the address, or Porto, or the first city by name
  const cityId =
    chosenCityId(searchParams.get("city"), cities) ??
    defaultCityId(cities, DEFAULT_CITY_ID);
  const cityName = cities.find((city) => city.id === cityId)?.name;
  const sections = savedSections(savedInCity(savedPlaces.saved, cityId));

  return (
    <>
      <CityFilter
        cities={cities}
        selectedId={cityId}
        hrefFor={savedHref}
        withAll={false}
      />
      {/* Full width (#187): the two lists side by side on a wide screen, one under the other on a small one */}
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        {SAVED_PLACE_TYPES.map((type) => {
          const Icon = SECTION_ICONS[type];
          const labels = SAVED_PLACE_LABELS[type];
          const entries = sections[type];
          const headingId = `saved-${type.toLowerCase()}-heading`;

          return (
            <section key={type} aria-labelledby={headingId} className="min-w-0">
              <h2
                id={headingId}
                tabIndex={-1}
                className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900 focus:outline-none"
              >
                <Icon className="h-5 w-5 text-slate-500" aria-hidden="true" />
                {labels.section}
                <span className="text-sm font-normal text-slate-500">
                  ({entries.length})
                </span>
              </h2>

              {entries.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  {cityName ? labels.emptyIn(cityName) : labels.empty}
                </p>
              ) : (
                <ul
                  role="list"
                  className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  {entries.map((entry) => (
                    <SavedPlaceRow
                      key={entry.place.id}
                      entry={entry}
                      removeLabel={labels.remove}
                      pending={savedPlaces.isPending(entry.place.id, type)}
                      onRemove={() => {
                        // The row goes away at once, so the focus would be lost: move it to the heading of the
                        // section, which also says the new count.
                        document.getElementById(headingId)?.focus();
                        void savedPlaces.toggle(entry.place, entry.type);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function SavedPlaceRow({
  entry,
  removeLabel,
  pending,
  onRemove,
}: {
  entry: SavedPlace;
  removeLabel: string;
  pending: boolean;
  onRemove: () => void;
}) {
  const { place } = entry;
  const category = getCategoryConfig(place.category);
  const location = placeLocation(place.address, place.city?.name);

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/places/${place.id}`}
          className="break-words font-medium text-slate-900 hover:text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:hover:text-indigo-400"
        >
          {place.name}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{category.label}</span>
          <span className="inline-flex items-center gap-0.5">
            <Star
              className="h-3 w-3 fill-amber-500 text-amber-500"
              aria-hidden="true"
            />
            {formatAverageRating(place.averageRating ?? null)}
          </span>
          {location && (
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (!pending) onRemove();
        }}
        aria-disabled={pending || undefined}
        aria-label={`${removeLabel}: ${place.name}`}
        className="shrink-0"
      >
        <X aria-hidden="true" />
        Remove
      </Button>
    </li>
  );
}
