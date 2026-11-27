"use client";

/**
 * The card above the ranking: the city buttons, the search box, the category filter and the
 * map. It only shows what it is given and reports changes; the state belongs to PlaceExplorer.
 */

import { MapPin, Loader2 } from "lucide-react";
import MapWrapper from "./MapWrapper";
import type { BoundingBox, MapPlace } from "./MapComponent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import CitySelector, { type CityOption } from "./CitySelector";
import PlaceSearchAutocomplete from "./PlaceSearchAutocomplete";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";
import {
  PRICE_LEVELS,
  formatPriceLevel,
  isPriceLevel,
} from "@/domain/reviews/rating";
import { NO_PLACE_FILTERS, type PlaceFilters } from "@/domain/catalog/filters";
import type { PlaceCategory } from "@prisma/client";
import { EXPLORE_MAP_ID } from "@/lib/show-map";

export interface CategoryOption {
  label: string;
  value: string;
}

export const CATEGORIES: CategoryOption[] = [
  { label: "All places", value: "ALL" },
  { label: "Monuments", value: "MONUMENT" },
  { label: "Restaurants", value: "RESTAURANT" },
  { label: "Parks", value: "PARK" },
  { label: "Museums", value: "MUSEUM" },
  { label: "Cafes", value: "CAFE" },
  { label: "Bars", value: "BAR" },
  { label: "Other", value: "OTHER" },
];

interface MapExplorerCardProps {
  places: MapPlace[];
  allPlaces?: PlaceItem[];
  selectedCenter: [number, number] | null;
  selectedCityCenter: [number, number] | null;
  /** A new list zooms the map out to show these points (All cities, #187). */
  fitPoints?: [number, number][] | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: PlaceFilters;
  onFiltersChange: (filters: PlaceFilters) => void;
  categories?: CategoryOption[];
  isFetchingOsm: boolean;
  cities?: CityOption[];
  selectedCityId?: string | null;
  activeCityName?: string;
  onSelectCity?: (city: CityOption | null) => void;
  onSelectPlace: (placeId: string) => void;
  onFocusPlace: (place: PlaceItem) => void;
  onSelectDiscoveredPlace?: (osmPlace: OsmSearchResult) => void;
  onMapMove: (bounds: BoundingBox) => void;
  /** Where the map opens; the home page gives where it was left (#187). */
  center: [number, number];
  zoom: number;
  onViewChange: (center: [number, number], zoom: number) => void;
}

export default function MapExplorerCard({
  places,
  allPlaces = [],
  selectedCenter,
  selectedCityCenter,
  fitPoints,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  categories = CATEGORIES,
  isFetchingOsm,
  cities,
  selectedCityId,
  activeCityName,
  onSelectCity,
  onSelectPlace,
  onFocusPlace,
  onSelectDiscoveredPlace,
  onMapMove,
  center,
  zoom,
  onViewChange,
}: MapExplorerCardProps) {
  const activeCategory = filters.category ?? "ALL";
  return (
    <Card id={EXPLORE_MAP_ID}>
      <CardHeader className="pb-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-rose-500" />
              Explore on the map
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Click any pin to review. Pan and zoom to discover new places from
              OpenStreetMap.
            </p>
          </div>

          {isFetchingOsm && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge
                variant="secondary"
                className="animate-pulse gap-1.5 border-indigo-200 bg-indigo-50 text-xs font-normal text-indigo-700"
              >
                <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                Loading OpenStreetMap…
              </Badge>
            </div>
          )}
        </div>

        {/* 1. European Cities Selector */}
        {cities && cities.length > 0 && onSelectCity && (
          <div className="mt-3.5">
            <CitySelector
              cities={cities}
              selectedCityId={selectedCityId ?? null}
              onSelectCity={onSelectCity}
            />
          </div>
        )}

        {/* 2. Search & Category Filters */}
        <div className="mt-3.5 flex flex-col items-stretch gap-2.5">
          <PlaceSearchAutocomplete
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            localPlaces={allPlaces}
            cityName={activeCityName}
            onSelectLocalPlace={onFocusPlace}
            onSelectOsmPlace={(osm) => {
              if (onSelectDiscoveredPlace) {
                onSelectDiscoveredPlace(osm);
              }
            }}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((category) => (
              <Button
                key={category.value}
                size="sm"
                variant={
                  activeCategory === category.value ? "default" : "outline"
                }
                onClick={() => {
                  const nextCategory =
                    category.value === "ALL"
                      ? null
                      : (category.value as PlaceCategory);
                  onFiltersChange({
                    ...filters,
                    category: nextCategory,
                  });
                }}
                className="h-7 rounded-full px-3 text-xs"
              >
                {category.label}
              </Button>
            ))}

            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="price-level-filter"
                className="mb-0 text-xs font-medium text-slate-600"
              >
                Price
              </Label>
              <select
                id="price-level-filter"
                aria-label="Price level"
                value={filters.priceLevel ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onFiltersChange({
                    ...filters,
                    priceLevel: isPriceLevel(val) ? val : null,
                  });
                }}
                className="shadow-xs h-7 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any</option>
                {PRICE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {formatPriceLevel(level)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="min-rating-filter"
                className="mb-0 text-xs font-medium text-slate-600"
              >
                Rating
              </Label>
              <select
                id="min-rating-filter"
                aria-label="Minimum rating"
                value={filters.minRating ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onFiltersChange({
                    ...filters,
                    minRating: val ? Number(val) : null,
                  });
                }}
                className="shadow-xs h-7 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
                <option value="4.5">4.5+</option>
              </select>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onFiltersChange(NO_PLACE_FILTERS)}
              className="h-7 rounded-full px-3 text-xs text-slate-600 hover:text-slate-900"
              aria-label="Clear filters"
            >
              Clear filters
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <MapWrapper
          places={places}
          center={center}
          zoom={zoom}
          onViewChange={onViewChange}
          selectedCenter={selectedCenter}
          selectedCityCenter={selectedCityCenter}
          fitPoints={fitPoints}
          onSelectPlace={onSelectPlace}
          onMapMove={onMapMove}
          // 440 px up to a laptop; on a big screen the map keeps the shape it has on a laptop (about 2.8 to 1)
          // instead of becoming a thin strip, up to three quarters of the window (#187)
          heightClassName="h-[440px] 2xl:aspect-[17/6] 2xl:h-auto 2xl:max-h-[75vh]"
        />
      </CardContent>
    </Card>
  );
}
