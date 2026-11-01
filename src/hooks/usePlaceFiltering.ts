import { useMemo } from "react";
import type { PlaceItem } from "@/types/place";
import type { MapPlace } from "@/components/MapComponent";
import { isPointInsideBounds, type GeoBoundingBox } from "@/domain/catalog/geo";

interface UsePlaceFilteringProps {
  places: readonly PlaceItem[];
  osmPlaces: readonly PlaceItem[];
  selectedCityId: string | null;
  currentPage: number;
  pageSize: number;
  mapBounds?: GeoBoundingBox | null;
}

export function usePlaceFiltering({
  places,
  osmPlaces,
  selectedCityId,
  currentPage,
  pageSize,
  mapBounds,
}: UsePlaceFilteringProps) {
  // 1. Single-pass merge of DB places and OSM places
  const allPlaces = useMemo(() => {
    const seenIds = new Set<string>();
    const merged: PlaceItem[] = [];

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      seenIds.add(place.id);
      merged.push(place);
    }

    for (let i = 0; i < osmPlaces.length; i++) {
      const osmPlace = osmPlaces[i];
      if (!seenIds.has(osmPlace.id)) {
        seenIds.add(osmPlace.id);
        merged.push(osmPlace);
      }
    }

    return merged;
  }, [places, osmPlaces]);

  // 2. Filter by city. Places found on OpenStreetMap have no city: they stay, the viewport limits them.
  const matchingPlaces = useMemo(
    () =>
      allPlaces.filter(
        (place) =>
          !selectedCityId || !place.cityId || place.cityId === selectedCityId
      ),
    [allPlaces, selectedCityId]
  );

  // 3. Filter by map viewport bounds and sort by rating descending
  const filteredPlaces = useMemo(() => {
    const inViewport = mapBounds
      ? matchingPlaces.filter((place) =>
          isPointInsideBounds(place.latitude, place.longitude, mapBounds)
        )
      : matchingPlaces;

    return [...inViewport].sort((a, b) => {
      const ratingA = a.averageRating ?? -1;
      const ratingB = b.averageRating ?? -1;
      if (ratingB !== ratingA) {
        return ratingB - ratingA;
      }
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
    });
  }, [matchingPlaces, mapBounds]);

  // 4. Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / pageSize));
  const paginatedPlaces = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredPlaces.slice(startIndex, startIndex + pageSize);
  }, [filteredPlaces, currentPage, pageSize]);

  // 5. Leaflet pins projection
  const mapPlaces: MapPlace[] = useMemo(() => {
    const validPins: MapPlace[] = [];

    for (let i = 0; i < matchingPlaces.length; i++) {
      const p = matchingPlaces[i];
      if (
        typeof p.latitude === "number" &&
        typeof p.longitude === "number" &&
        !isNaN(p.latitude) &&
        !isNaN(p.longitude)
      ) {
        validPins.push({
          id: p.id,
          name: p.name,
          category: p.category,
          priceLevel: p.priceLevel || "€",
          rating: p.averageRating,
          latitude: p.latitude,
          longitude: p.longitude,
          isDiscovered: p.isDiscovered,
        });
      }
    }

    return validPins;
  }, [matchingPlaces]);

  return {
    allPlaces,
    filteredPlaces,
    paginatedPlaces,
    mapPlaces,
    totalPages,
  };
}
