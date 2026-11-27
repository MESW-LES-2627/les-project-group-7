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
import { cityInView } from "@/domain/catalog/city-in-view";
import {
  cameBackByHistory,
  recallExplore,
  rememberExplore,
} from "@/lib/explore-memory";

/** Where the map opens when nothing is remembered: Porto. */
const START_CENTER: [number, number] = [41.147, -8.615];
const START_ZOOM = 14;
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
  // The page as it was left, when the person comes back to it (Back, the Tripbook link); empty after a
  // refresh (#187)
  const [remembered] = useState(recallExplore);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(
    remembered.cityId ?? null
  );
  const [fitPoints, setFitPoints] = useState<[number, number][] | null>(null);
  // The ranking follows the city of the map (#187), but only after a move of the person: a move the
  // page makes itself (a Map button, a search result) leaves the city as it is.
  // Coming back, the map reports where it is when it opens: the city stays the one it was left on
  const ignoreMapMovesUntil = useRef(
    remembered.cityId !== undefined ? Date.now() + 1500 : 0
  );
  const [searchQuery, setSearchQuery] = useState(remembered.searchQuery ?? "");
  const [filters, setFilters] = useState<PlaceFilters>(
    remembered.filters ?? NO_PLACE_FILTERS
  );
  const [currentPage, setCurrentPage] = useState(remembered.currentPage ?? 1);
  const [viewMode, setViewMode] = useState<"table" | "grid">(
    remembered.viewMode ?? "table"
  );

  useEffect(() => {
    rememberExplore({
      cityId: selectedCityId,
      searchQuery,
      filters,
      currentPage,
      viewMode,
    });
  }, [selectedCityId, searchQuery, filters, currentPage, viewMode]);

  // How far down the page is when the person leaves it, given back on Back or Forward; a link (the
  // Tripbook link) starts at the top. It is taken on the click that leaves (any click, before the next
  // page scrolls to its top) and on Back or Forward away from here, which only this page hears.
  useEffect(() => {
    const keepScroll = () => rememberExplore({ scrollY: window.scrollY });
    document.addEventListener("click", keepScroll, true);
    window.addEventListener("popstate", keepScroll);
    return () => {
      document.removeEventListener("click", keepScroll, true);
      window.removeEventListener("popstate", keepScroll);
    };
  }, []);

  useEffect(() => {
    const y = remembered.scrollY;
    if (!y || !cameBackByHistory()) return;

    // After the page is drawn, so it is as long as it was when it was left
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [remembered]);

  const handleViewChange = useCallback(
    (center: [number, number], zoom: number) =>
      rememberExplore({ center, zoom }),
    []
  );

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

  // Back to page 1 when the filters, the search or the city change, not when the page opens with the
  // page it was left on (compared by value: React runs this twice when it starts, in development)
  const listedBy = JSON.stringify([filters, searchQuery, selectedCityId]);
  const lastListedBy = useRef(listedBy);
  useEffect(() => {
    if (listedBy === lastListedBy.current) return;
    lastListedBy.current = listedBy;
    setCurrentPage(1);
  }, [listedBy]);

  // Moving the map replaces the OpenStreetMap places, so the list can get shorter than the page
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // Smoothly pan map to selected city
  const handleSelectCity = useCallback(
    (city: CityOption | null) => {
      setFocusedPlace(null);
      if (!city) {
        // The map zooms out to every city, so it shows what the ranking shows
        setSelectedCityId(null);
        setFitPoints(initialCities.map((c) => [c.latitude, c.longitude]));
        return;
      }
      setSelectedCityId(city.id);
      setSelectedCityCenter([city.latitude, city.longitude]);
    },
    [initialCities]
  );

  /** Centres the map on a place without changing the city of the ranking. */
  const centerOnPlace = useCallback((center: [number, number]) => {
    // The fly takes 0.8 s and ends with one move of the map
    ignoreMapMovesUntil.current = Date.now() + 1500;
    setSelectedMapCenter(center);
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
    reviewsFailed,
    retryReviews,
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

  const handleFocusPlace = useCallback(
    (place: PlaceItem) => {
      setFocusedPlace(place);
      setSearchQuery(place.name);
      // The ranking goes to the city of the place, where the map is going (a place found only on
      // OpenStreetMap has no city yet: the nearest one, or all cities)
      setSelectedCityId(
        place.cityId ??
          cityInView(
            {
              south: place.latitude,
              north: place.latitude,
              west: place.longitude,
              east: place.longitude,
            },
            initialCities
          )
      );
      centerOnPlace([place.latitude, place.longitude]);
    },
    [centerOnPlace, initialCities]
  );

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
  const handleMapMove = useCallback(
    (bounds: BoundingBox) => {
      if (Date.now() >= ignoreMapMovesUntil.current) {
        setSelectedCityId(cityInView(bounds, initialCities));
      }

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
    },
    [initialCities]
  );

  const listProps = {
    paginatedPlaces,
    filteredPlacesCount: filteredPlaces.length,
    currentPage,
    totalPages,
    pageSize: PAGE_SIZE,
    onPageChange: setCurrentPage,
    onSelectMapCenter: centerOnPlace,
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
          fitPoints={fitPoints}
          center={remembered.center ?? START_CENTER}
          zoom={remembered.zoom ?? START_ZOOM}
          onViewChange={handleViewChange}
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
                Place ranking{activeCityName ? ` in ${activeCityName}` : ""}
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
          reviewsFailed={reviewsFailed}
          onRetryReviews={retryReviews}
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
