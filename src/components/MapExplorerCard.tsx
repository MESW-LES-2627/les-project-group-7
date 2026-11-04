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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import CitySelector, { type CityOption } from "./CitySelector";
import PlaceSearchAutocomplete from "./PlaceSearchAutocomplete";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";

export interface CategoryOption {
  label: string;
  value: string;
}

export const CATEGORIES: CategoryOption[] = [
  { label: "All Spots", value: "ALL" },
  { label: "Monuments", value: "MONUMENT" },
  { label: "Restaurants", value: "RESTAURANT" },
  { label: "Parks", value: "PARK" },
  { label: "Museums", value: "MUSEUM" },
  { label: "Cafes", value: "CAFE" },
  { label: "Bars", value: "BAR" },
];

interface MapExplorerCardProps {
  places: MapPlace[];
  allPlaces?: PlaceItem[];
  selectedCenter: [number, number] | null;
  selectedCityCenter: [number, number] | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
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
}

export default function MapExplorerCard({
  places,
  allPlaces = [],
  selectedCenter,
  selectedCityCenter,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
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
}: MapExplorerCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-rose-500" />
              Explore on Map
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
                Loading OSM...
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
        <div className="mt-3.5 flex flex-col items-stretch gap-2.5 lg:flex-row lg:items-center">
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

          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <Button
                key={category.value}
                size="sm"
                variant={
                  selectedCategory === category.value ? "default" : "outline"
                }
                onClick={() => onCategoryChange(category.value)}
                className="h-7 rounded-full px-3 text-xs"
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <MapWrapper
          places={places}
          center={[41.147, -8.615]}
          zoom={14}
          selectedCenter={selectedCenter}
          selectedCityCenter={selectedCityCenter}
          onSelectPlace={onSelectPlace}
          onMapMove={onMapMove}
        />
      </CardContent>
    </Card>
  );
}
