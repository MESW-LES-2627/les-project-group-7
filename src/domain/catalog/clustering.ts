/**
 * Architecture Summary:
 * Pure domain module responsible for spatial aggregation of map points.
 * Implements an O(N) spatial grid hashing algorithm that groups proximal places
 * into clusters when the map is zoomed out, maintaining 60 FPS performance without
 * external heavy GIS dependencies.
 *
 * Domain Policy:
 * - Zoom < 16: Places in the same pixel grid cell are clustered. Single places remain pins.
 * - Zoom >= 16: Street level view — all places are displayed as individual pins.
 *
 * Actionable Edit Hint:
 * - To adjust clustering granularity, modify `pixelRadius` (default: 55px).
 */

import type { MapPlace } from "@/components/MapComponent";

export interface MapCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  places: MapPlace[];
}

export interface ClusteredResult {
  singlePins: MapPlace[];
  clusters: MapCluster[];
}

/**
 * Groups nearby geographical points into spatial grid clusters based on zoom level.
 * When zoom >= 16 (street level), all places are returned as individual pins.
 * Employs single-pass O(N) spatial hashing with O(1) auxiliary overhead.
 *
 * @param places - Array of places with geographical coordinates
 * @param zoom - Current Leaflet map zoom level (integer)
 * @param pixelRadius - Clustering sensitivity radius in screen pixels (default: 55)
 * @returns ClusteredResult with distinct single pins and grouped cluster nodes
 */
export function clusterPlaces(
  places: readonly MapPlace[],
  zoom: number,
  pixelRadius = 55
): ClusteredResult {
  if (zoom >= 16 || places.length <= 1) {
    return { singlePins: [...places], clusters: [] };
  }

  // Calculate latitude & longitude degree span for the given pixel radius at zoom Z
  const degreeSpan = (360 / (256 * Math.pow(2, zoom))) * pixelRadius;
  const gridSizeLat = degreeSpan;
  const gridSizeLon = degreeSpan / 0.753; // cos(41.15°) ≈ 0.753 for European average latitude

  const grid = new Map<string, MapPlace[]>();

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const cellX = Math.floor(place.longitude / gridSizeLon);
    const cellY = Math.floor(place.latitude / gridSizeLat);
    const key = `${cellX}:${cellY}`;

    const cell = grid.get(key);
    if (cell) {
      cell.push(place);
    } else {
      grid.set(key, [place]);
    }
  }

  const singles: MapPlace[] = [];
  const clusterList: MapCluster[] = [];

  grid.forEach((items, key) => {
    if (items.length === 1) {
      singles.push(items[0]);
    } else {
      let sumLat = 0;
      let sumLon = 0;

      for (let j = 0; j < items.length; j++) {
        sumLat += items[j].latitude;
        sumLon += items[j].longitude;
      }

      clusterList.push({
        id: `cluster-${key}`,
        latitude: sumLat / items.length,
        longitude: sumLon / items.length,
        count: items.length,
        places: items,
      });
    }
  });

  return { singlePins: singles, clusters: clusterList };
}
