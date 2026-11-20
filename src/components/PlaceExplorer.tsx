"use client";

/**
 * The main screen of the home page. It keeps the state of the explorer (the catalog, the
 * selected city, the search text, the filters and the page) and puts
 * together the map card, the ranking (table or cards) and the review dialog. It also asks
 * OpenStreetMap for the places of the visible map area, which are shown as discovered.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { LayoutList, LayoutGrid, Trophy } from "lucide-react";
import type { BoundingBox } from "./MapComponent";
import { Button } from "@/components/ui/button";
import MapExplorerCard from "./MapExplorerCard";
import PlaceGrid from "./PlaceGrid";
import PlaceDataTable from "./PlaceDataTable";
import ReviewModal, { type ReviewItem } from "./ReviewModal";
import SavedPlacesProvider from "./SavedPlacesProvider";
import type { CityOption } from "./CitySelector";
import { usePlaceReviews } from "@/hooks/usePlaceReviews";
import { usePlaceFiltering } from "@/hooks/usePlaceFiltering";
import { NO_PLACE_FILTERS, type PlaceFilters } from "@/domain/catalog/filters";

import { discoveredPlaceId } from "@/domain/osm/osm";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";
export type { PlaceItem };

const PAGE_SIZE = 18;

export default function PlaceExplorer({
  initialPlaces,
  initialCities = [],
  currentUsername,
}: {
  initialPlaces: PlaceItem[];
  initialCities?: CityOption[];
  currentUsername: string | null;
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
  const [selectedCityCenter, setSelectedCityCenter] = useState<
    [number, number] | null
  >(null);
  const [focusedPlace, setFocusedPlace] = useState<PlaceItem | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<PlaceFilters>(NO_PLACE_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const activeCityName = initialCities.find(
    (c) => c.id === selectedCityId
  )?.name;

  // Multi-criteria filtering, spatial bounding box, pagination and pin projections
  const osmPlacesWithFocused = useMemo(
    () =>
      focusedPlace?.isDiscovered ? [focusedPlace, ...osmPlaces] : osmPlaces,
    [focusedPlace, osmPlaces]
  );

  const { allPlaces, filteredPlaces, paginatedPlaces, mapPlaces, totalPages } =
    usePlaceFiltering({
      places,
      osmPlaces: osmPlacesWithFocused,
      selectedCityId,
      filters,
      searchQuery,
      currentPage,
      pageSize: PAGE_SIZE,
    });

  // Reset pagination on filter or city change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery, selectedCityId]);

  // Moving the map replaces the OpenStreetMap places, so the list can get shorter than the page
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Smoothly pan map to selected city
  const handleSelectCity = useCallback((city: CityOption | null) => {
    setFocusedPlace(null);
    if (!city) {
      setSelectedCityId(null);
      return;
    }
    setSelectedCityId(city.id);
    setSelectedCityCenter([city.latitude, city.longitude]);
  }, []);

  // Callback to sync catalog updates when a review is submitted
  const handlePlaceUpdated = useCallback(
    (updatedPlace: PlaceItem, _createdReview?: ReviewItem) => {
      setFocusedPlace(null);

      const patch = {
        averageRating: updatedPlace.averageRating,
        reviewCount: updatedPlace.reviewCount,
        priceLevel: updatedPlace.priceLevel,
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
                priceLevel: updatedPlace.priceLevel,
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
    currentUsername,
    onPlaceUpdated: handlePlaceUpdated,
  });

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setFocusedPlace(null);
  }, []);

  const handleSelectPlace = useCallback(
    (id: string) => {
      const place = allPlaces.find((item) => item.id === id);
      if (place) openReviewModal(place);
    },
    [allPlaces, openReviewModal]
  );

  const handleFocusPlace = useCallback((place: PlaceItem) => {
    setFocusedPlace(place);
    setSearchQuery(place.name);
    setSelectedMapCenter([place.latitude, place.longitude]);
  }, []);

  const handleSelectDiscoveredPlace = useCallback(
    (osm: OsmSearchResult) => {
      handleFocusPlace({
        id: discoveredPlaceId(osm.osmId),
        osmId: osm.osmId,
        name: osm.name,
        category: osm.category,
        address: osm.address,
        latitude: osm.latitude,
        longitude: osm.longitude,
        priceLevel: null,
        averageRating: null,
        reviewCount: 0,
        isDiscovered: true,
      });
    },
    [handleFocusPlace]
  );

  const mapPins = useMemo(() => {
    if (!focusedPlace || mapPlaces.some((p) => p.id === focusedPlace.id)) {
      return mapPlaces;
    }
    return [
      ...mapPlaces,
      {
        id: focusedPlace.id,
        name: focusedPlace.name,
        category: focusedPlace.category,
        priceLevel: focusedPlace.priceLevel ?? null,
        rating: focusedPlace.averageRating,
        latitude: focusedPlace.latitude,
        longitude: focusedPlace.longitude,
        isDiscovered: focusedPlace.isDiscovered,
      },
    ];
  }, [mapPlaces, focusedPlace]);

  // Debounced OpenStreetMap fetch for the visible map area
  const handleMapMove = useCallback((bounds: BoundingBox) => {
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
    onSelectMapCenter: setSelectedMapCenter,
    onOpenReview: openReviewModal,
  };

  return (
    <SavedPlacesProvider loggedIn={currentUsername !== null}>
      <div className="space-y-8">
        {/* ── 2. Map Explorer & City Selector ──────────────────────────────── */}
        <MapExplorerCard
          places={mapPins}
          allPlaces={allPlaces}
          selectedCenter={selectedMapCenter}
          selectedCityCenter={selectedCityCenter}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          filters={filters}
          onFiltersChange={setFilters}
          isFetchingOsm={isFetchingOsm}
          cities={initialCities}
          selectedCityId={selectedCityId}
          activeCityName={activeCityName}
          onSelectCity={handleSelectCity}
          onSelectPlace={handleSelectPlace}
          onFocusPlace={handleFocusPlace}
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
                {filteredPlaces.length} of {allPlaces.length} places, best
                rating score first
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
          currentUsername={currentUsername}
          reviews={reviewsList}
          isLoadingReviews={isLoadingReviews}
          isSubmitting={isSubmitting}
          submitSuccess={submitSuccess}
          errorMessage={errorMsg}
          onClose={closeReviewModal}
          onSubmit={handleSubmitReview}
        />
      </div>
    </SavedPlacesProvider>
  );
}
