"use client";

/**
 * Interactive Leaflet Map Component with Viewport Culling & Grid Clustering.
 *
 * Features:
 * - Viewport Culling: Only places within map bounds + 15% margin are computed.
 * - Distance Grid Clustering: Nearby spots cluster into numbered badges when zoomed out.
 * - Click-to-Zoom: Clicking a cluster smoothly flies in and expands the spots.
 * - Memoized SVG pins & Canvas rendering (preferCanvas) for rock-solid 60 FPS.
 */

import { useEffect, useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { clusterPlaces } from "@/domain/catalog/clustering";
import { type GeoBoundingBox } from "@/domain/catalog/geo";
import { formatPriceLevel } from "@/domain/reviews/rating";
import MapClusterMarker from "./MapClusterMarker";

export interface MapPlace {
  id: string;
  name: string;
  category: string;
  priceLevel: string | null;
  rating: number | null;
  latitude: number;
  longitude: number;
  isDiscovered?: boolean;
}

export type BoundingBox = GeoBoundingBox;

const CATEGORY_COLORS: Record<string, string> = {
  MONUMENT: "#4f46e5", // Indigo
  MUSEUM: "#7c3aed", // Purple
  RESTAURANT: "#059669", // Emerald
  CAFE: "#d97706", // Amber
  BAR: "#db2777", // Pink
  PARK: "#16a34a", // Green
  OTHER: "#475569", // Slate
};

const ICON_CACHE = new Map<string, L.DivIcon>();

function getCategoryIcon(category: string): L.DivIcon {
  const cached = ICON_CACHE.get(category);
  if (cached) {
    return cached;
  }

  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER;
  const icon = L.divIcon({
    className: "custom-map-pin",
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
    html: `
      <div style="position: relative; width: 28px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <svg viewBox="0 0 28 38" width="28" height="38" fill="${color}" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.8 14 24 14 24s14-14.2 14-24c0-7.732-6.268-14-14-14z"/>
          <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
  });

  ICON_CACHE.set(category, icon);
  return icon;
}

function MapEventHandler({
  onMapMove,
  onBoundsChange,
  onZoomChange,
}: {
  onMapMove?: (bounds: BoundingBox) => void;
  onBoundsChange?: (bounds: BoundingBox) => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      const bbox: BoundingBox = {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      };

      onBoundsChange?.(bbox);
      onZoomChange?.(map.getZoom());
      onMapMove?.(bbox);
    },
    zoomend: () => {
      onZoomChange?.(map.getZoom());
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    const bbox: BoundingBox = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    };

    onBoundsChange?.(bbox);
    onZoomChange?.(map.getZoom());
    onMapMove?.(bbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// A chosen place is seen up close; a chosen city is seen whole.
const PLACE_ZOOM = 16;
const CITY_ZOOM = 13;

function MapFlyController({
  targetCenter,
  zoom,
}: {
  targetCenter?: [number, number] | null;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (targetCenter) {
      map.flyTo(targetCenter, zoom, { duration: 0.8 });
    }
  }, [targetCenter, zoom, map]);

  return null;
}

export default function MapComponent({
  places = [],
  center = [41.147, -8.615],
  zoom = 14,
  selectedCenter,
  selectedCityCenter,
  onSelectPlace,
  onMapMove,
}: {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  selectedCenter?: [number, number] | null;
  selectedCityCenter?: [number, number] | null;
  onSelectPlace?: (placeId: string) => void;
  onMapMove?: (bounds: BoundingBox) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<BoundingBox | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Viewport Culling: Filters spots within the visible screen + 15% margin
  const visiblePlaces = useMemo(() => {
    if (!currentBounds) {
      return places;
    }

    const latBuffer =
      Math.abs(currentBounds.north - currentBounds.south) * 0.15;
    const lonBuffer = Math.abs(currentBounds.east - currentBounds.west) * 0.15;

    const minLat = currentBounds.south - latBuffer;
    const maxLat = currentBounds.north + latBuffer;
    const minLon = currentBounds.west - lonBuffer;
    const maxLon = currentBounds.east + lonBuffer;

    const culled: MapPlace[] = [];
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      if (
        place.latitude >= minLat &&
        place.latitude <= maxLat &&
        place.longitude >= minLon &&
        place.longitude <= maxLon
      ) {
        culled.push(place);
      }
    }

    return culled;
  }, [places, currentBounds]);

  // 2. Spatial Grid Clustering: Groups nearby spots into numbered bubbles when zoomed out
  const { singlePins, clusters } = useMemo(() => {
    return clusterPlaces(visiblePlaces, currentZoom);
  }, [visiblePlaces, currentZoom]);

  if (!mounted) {
    return (
      <div className="flex h-[440px] w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative z-0 h-[440px] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        preferCanvas={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Viewport Bounds & Zoom Tracker */}
        <MapEventHandler
          onMapMove={onMapMove}
          onBoundsChange={setCurrentBounds}
          onZoomChange={setCurrentZoom}
        />

        {/* Smooth Fly-To Controller */}
        <MapFlyController targetCenter={selectedCenter} zoom={PLACE_ZOOM} />
        <MapFlyController targetCenter={selectedCityCenter} zoom={CITY_ZOOM} />

        {/* 1. Render Clustered Badges */}
        {clusters.map((cluster) => (
          <MapClusterMarker key={cluster.id} cluster={cluster} />
        ))}

        {/* 2. Render Single Spot Pins */}
        {singlePins.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={getCategoryIcon(place.category)}
          >
            <Popup>
              <div className="min-w-[190px] p-1">
                {place.isDiscovered && (
                  <span className="mb-1 inline-block rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                    OSM Discovered
                  </span>
                )}
                <h4 className="text-sm font-bold leading-tight text-slate-900">
                  {place.name}
                </h4>

                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    {place.rating ? place.rating.toFixed(1) : "—"}
                  </span>
                  <span>•</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">
                    {formatPriceLevel(place.priceLevel)}
                  </span>
                  <span>•</span>
                  <span className="text-slate-500">
                    {getCategoryConfig(place.category).label}
                  </span>
                </div>

                {onSelectPlace && (
                  <Button
                    size="sm"
                    onClick={() => onSelectPlace(place.id)}
                    className="mt-2.5 h-7 w-full gap-1 text-xs"
                  >
                    <Star className="h-3 w-3 fill-white" />
                    {place.isDiscovered
                      ? "Be first to rate"
                      : "See details and reviews"}
                  </Button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
