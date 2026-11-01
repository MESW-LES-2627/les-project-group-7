"use client";

import { MapPin, Loader2 } from "lucide-react";
import MapWrapper from "./MapWrapper";
import type { BoundingBox, MapPlace } from "./MapComponent";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import CitySelector, { type CityOption } from "./CitySelector";
import PlaceSearchAutocomplete from "./PlaceSearchAutocomplete";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";

interface MapExplorerCardProps {
  places: MapPlace[];
  allPlaces?: PlaceItem[];
  selectedCenter: [number, number] | null;
  selectedBounds?: BoundingBox | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isFetchingOsm: boolean;
  cities?: CityOption[];
  selectedCityId?: string | null;
  mapBounds?: BoundingBox | null;
  onSelectCity: (city: CityOption | null) => void;
  onAddCity: (city: CityOption) => void;
  canAddCity?: boolean;
  onSelectPlace: (placeId: string) => void;
  onGoToPlace: (place: PlaceItem) => void;
  onSelectDiscoveredPlace?: (osmPlace: OsmSearchResult) => void;
  onMapMove: (bounds: BoundingBox) => void;
}

export default function MapExplorerCard({
  places,
  allPlaces = [],
  selectedCenter,
  selectedBounds,
  searchQuery,
  onSearchChange,
  isFetchingOsm,
  cities,
  selectedCityId,
  mapBounds,
  onSelectCity,
  onAddCity,
  canAddCity = false,
  onSelectPlace,
  onGoToPlace,
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
        {cities && cities.length > 0 && (
          <div className="mt-3.5">
            <CitySelector
              cities={cities}
              selectedCityId={selectedCityId ?? null}
              onSelectCity={onSelectCity}
            />
          </div>
        )}

        {/* 2. Search */}
        <div className="mt-3.5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
          <PlaceSearchAutocomplete
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            localPlaces={allPlaces}
            bounds={mapBounds}
            cities={cities ?? []}
            onSelectCity={onSelectCity}
            onAddCity={onAddCity}
            canAddCity={canAddCity}
            onSelectLocalPlace={onGoToPlace}
            onSelectOsmPlace={(osm) => {
              if (onSelectDiscoveredPlace) {
                onSelectDiscoveredPlace(osm);
              }
            }}
          />
        </div>
      </CardHeader>

      <CardContent>
        <MapWrapper
          places={places}
          center={[41.147, -8.615]}
          zoom={14}
          selectedCenter={selectedCenter}
          selectedBounds={selectedBounds}
          onSelectPlace={onSelectPlace}
          onMapMove={onMapMove}
        />
      </CardContent>
    </Card>
  );
}
