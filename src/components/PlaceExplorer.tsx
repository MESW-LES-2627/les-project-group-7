"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { LayoutList, LayoutGrid, Trophy } from "lucide-react";
import type { BoundingBox } from "./MapComponent";
import { Button } from "@/components/ui/button";
import { type SessionUser, AVAILABLE_USERS } from "./UserSessionBar";
import MapExplorerCard from "./MapExplorerCard";
import PlaceGrid from "./PlaceGrid";
import PlaceDataTable from "./PlaceDataTable";
import ReviewModal, { type ReviewItem } from "./ReviewModal";
import type { CityOption } from "./CitySelector";
import { cityBounds } from "@/domain/catalog/city";
import { usePlaceReviews } from "@/hooks/usePlaceReviews";
import { usePlaceFiltering } from "@/hooks/usePlaceFiltering";

import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";
export type { PlaceItem };

const PAGE_SIZE = 18;

export default function PlaceExplorer({
  initialPlaces,
  initialCities = [],
  isLoggedIn = false,
  initialUser = AVAILABLE_USERS[0],
}: {
  initialPlaces: PlaceItem[];
  initialCities?: CityOption[];
  isLoggedIn?: boolean;
  initialUser?: SessionUser;
}) {
  // ── 1. Catalog & OSM integration ───────────────────────────────────────────
  const [places, setPlaces] = useState<PlaceItem[]>(initialPlaces);
  const [osmPlaces, setOsmPlaces] = useState<PlaceItem[]>([]);
  const [isFetchingOsm, setIsFetchingOsm] = useState(false);
  const osmDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 2. Map, filters & session ──────────────────────────────────────────────
  const [selectedMapCenter, setSelectedMapCenter] = useState<
    [number, number] | null
  >(null);
  // Where the map flies to. With bounds it shows that whole area (a city, a country); without,
  // it zooms in on the point.
  const [selectedMapBounds, setSelectedMapBounds] =
    useState<BoundingBox | null>(null);
  const flyTo = useCallback(
    (center: [number, number], bounds: BoundingBox | null = null) => {
      setSelectedMapCenter(center);
      setSelectedMapBounds(bounds);
    },
    []
  );
  // Demo author of new reviews until the reviews endpoint reads the real session (#14, #15).
  const currentUser = initialUser;
  // The map starts on Porto (see MapExplorerCard), so Porto is the active city.
  const [selectedCityId, setSelectedCityId] = useState<string | null>(
    () => initialCities.find((c) => c.name === "Porto")?.id ?? null
  );
  const [cities, setCities] = useState<CityOption[]>(initialCities);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [mapBounds, setMapBounds] = useState<BoundingBox | null>(null);

  const activeCityName = cities.find((c) => c.id === selectedCityId)?.name;

  // Multi-criteria filtering, spatial bounding box, pagination and pin projections
  const { allPlaces, filteredPlaces, paginatedPlaces, mapPlaces, totalPages } =
    usePlaceFiltering({
      places,
      osmPlaces,
      selectedCityId,
      currentPage,
      pageSize: PAGE_SIZE,
      mapBounds,
    });

  // Reset pagination on filter, city or viewport change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCityId, mapBounds]);

  // Smoothly pan map to selected city
  const handleSelectCity = useCallback(
    (city: CityOption | null) => {
      if (!city) {
        setSelectedCityId(null);
        return;
      }
      setSelectedCityId(city.id);
      flyTo(
        [city.latitude, city.longitude],
        cityBounds(city.latitude, city.longitude)
      );
    },
    [flyTo]
  );

  // A city added from the search joins the chips and becomes the active one.
  const handleAddCity = useCallback(
    (city: CityOption) => {
      setCities((prev) =>
        prev.some((c) => c.id === city.id)
          ? prev
          : [...prev, { ...city, count: 0 }]
      );
      handleSelectCity(city);
    },
    [handleSelectCity]
  );

  // Callback to sync catalog updates when a review is submitted
  const handlePlaceUpdated = useCallback(
    (updatedPlace: PlaceItem, _createdReview?: ReviewItem) => {
      const patch = {
        averageRating: updatedPlace.averageRating,
        reviewCount: updatedPlace.reviewCount,
        isVisited: true,
      };

      setPlaces((prev) => {
        const exists = prev.some((p) => p.id === updatedPlace.id);
        if (exists) {
          return prev.map((p) =>
            p.id === updatedPlace.id ? { ...p, ...patch } : p
          );
        }
        return [{ ...updatedPlace, ...patch }, ...prev];
      });

      setOsmPlaces((prev) =>
        prev.map((osm) =>
          osm.id === updatedPlace.id
            ? {
                ...osm,
                averageRating: updatedPlace.averageRating,
                reviewCount: updatedPlace.reviewCount,
              }
            : osm
        )
      );
    },
    []
  );

  // ── 3. Review Management Hook ──────────────────────────────────────────────
  const {
    activeReviewPlace,
    reviewsList,
    isLoadingReviews,
    isSubmitting,
    submitSuccess,
    errorMsg,
    openReviewModal,
    closeReviewModal,
    handleSubmitReview,
  } = usePlaceReviews({
    currentUser,
    onPlaceUpdated: handlePlaceUpdated,
  });

  // Search results take you to the place on the map. A catalog place also switches to its city,
  // otherwise the city filter would hide its pin.
  const handleGoToPlace = useCallback(
    (place: PlaceItem) => {
      if (place.cityId) setSelectedCityId(place.cityId);
      flyTo([place.latitude, place.longitude]);
    },
    [flyTo]
  );

  const handleSelectDiscoveredPlace = useCallback(
    (osm: OsmSearchResult) =>
      flyTo([osm.latitude, osm.longitude], osm.boundingBox ?? null),
    [flyTo]
  );

  // Debounced bounding-box OSM fetcher & viewport tracker
  const handleMapMove = useCallback((bounds: BoundingBox) => {
    setMapBounds(bounds);
    if (osmDebounceRef.current) clearTimeout(osmDebounceRef.current);

    osmDebounceRef.current = setTimeout(async () => {
      setIsFetchingOsm(true);
      try {
        const params = new URLSearchParams({
          south: bounds.south.toString(),
          west: bounds.west.toString(),
          north: bounds.north.toString(),
          east: bounds.east.toString(),
        });
        const res = await fetch(`/api/osm?${params}`);
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (Array.isArray(data)) setOsmPlaces(data);
      } catch {
        // Silently ignore — OSM data is supplementary
      } finally {
        setIsFetchingOsm(false);
      }
    }, 350);
  }, []);

  const listProps = {
    paginatedPlaces,
    filteredPlacesCount: filteredPlaces.length,
    currentPage,
    totalPages,
    pageSize: PAGE_SIZE,
    onPageChange: setCurrentPage,
    onSelectMapCenter: (coords: [number, number]) => flyTo(coords),
    onOpenReview: openReviewModal,
  };

  return (
    <div className="space-y-8">
      {/* ── 2. Map Explorer & City Selector ──────────────────────────────── */}
      <MapExplorerCard
        places={mapPlaces}
        allPlaces={allPlaces}
        selectedCenter={selectedMapCenter}
        selectedBounds={selectedMapBounds}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isFetchingOsm={isFetchingOsm}
        cities={cities}
        selectedCityId={selectedCityId}
        mapBounds={mapBounds}
        onSelectCity={handleSelectCity}
        onAddCity={handleAddCity}
        canAddCity={isLoggedIn}
        onSelectPlace={(id) => {
          const place = allPlaces.find((item) => item.id === id);
          if (place) openReviewModal(place);
        }}
        onGoToPlace={handleGoToPlace}
        onSelectDiscoveredPlace={handleSelectDiscoveredPlace}
        onMapMove={handleMapMove}
      />

      {/* ── 3. Ranking & Spots Catalog ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Trophy className="h-5 w-5 text-amber-500" />
              Place Ranking{activeCityName ? ` in ${activeCityName}` : ""}
            </h2>
            <p className="text-xs text-slate-500">
              {filteredPlaces.length} of {allPlaces.length} places visible on
              the map (sorted by rating)
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <Button
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              onClick={() => setViewMode("table")}
              className={`h-7 gap-1.5 px-3 text-xs font-medium ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Table
            </Button>
            <Button
              size="sm"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              onClick={() => setViewMode("grid")}
              className={`h-7 gap-1.5 px-3 text-xs font-medium ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </Button>
          </div>
        </div>

        {viewMode === "table" ? (
          <PlaceDataTable {...listProps} />
        ) : (
          <PlaceGrid {...listProps} />
        )}
      </div>

      {/* ── 4. Review Dialog ─────────────────────────────────────────────── */}
      <ReviewModal
        place={activeReviewPlace}
        currentUser={currentUser}
        reviews={reviewsList}
        isLoadingReviews={isLoadingReviews}
        isSubmitting={isSubmitting}
        submitSuccess={submitSuccess}
        errorMessage={errorMsg}
        onClose={closeReviewModal}
        onSubmit={handleSubmitReview}
      />
    </div>
  );
}
