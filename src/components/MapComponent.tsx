"use client";

/**
 * Interactive Leaflet Map Component.
 * 
 * Renders OpenStreetMap vector/raster tiles, dynamic category-colored SVG markers,
 * and handles smooth viewport animations (flyTo) and bounding-box synchronization.
 * 
 * Developer Notes:
 * - This component must be wrapped by MapWrapper (ssr: false) to prevent browser window hydration errors.
 * - Marker icons are memoized in ICON_CACHE to avoid allocating DOM nodes on every pan/zoom frame.
 */

import { useEffect, useState } from "react";
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

export interface MapPlace {
  id: string;
  name: string;
  category: string;
  priceLevel: string;
  rating: number | null;
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  MONUMENT: "#4f46e5", // Indigo
  MUSEUM: "#7c3aed",   // Purple
  RESTAURANT: "#059669",// Emerald
  CAFE: "#d97706",     // Amber
  BAR: "#db2777",      // Pink
  PARK: "#16a34a",     // Green
  OTHER: "#475569",    // Slate
};

/** Static icon cache to prevent allocating L.divIcon instances on every render cycle */
const ICON_CACHE = new Map<string, L.DivIcon>();

/**
 * Retrieves a cached, crisp retina SVG marker icon per category.
 */
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
      <div style="position: relative; width: 28px; height: 38px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35)); cursor: pointer;">
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

/** Listens to Leaflet events and triggers bounding box updates */
function MapEventHandler({
  onMapMove,
}: {
  onMapMove?: (bounds: BoundingBox) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      if (!onMapMove) return;
      const bounds = map.getBounds();
      onMapMove({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    },
  });

  // Emit initial view bounds on mount
  useEffect(() => {
    if (!onMapMove) return;
    const bounds = map.getBounds();
    onMapMove({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Smoothly centers the map on target coordinates when changed */
function MapFlyController({
  targetCenter,
}: {
  targetCenter?: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (targetCenter) {
      map.flyTo(targetCenter, 16, { duration: 0.8 });
    }
  }, [targetCenter, map]);

  return null;
}

export default function MapComponent({
  places = [],
  center = [41.147, -8.615],
  zoom = 14,
  selectedCenter,
  onSelectPlace,
  onMapMove,
}: {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  selectedCenter?: [number, number] | null;
  onSelectPlace?: (placeId: string) => void;
  onMapMove?: (bounds: BoundingBox) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[440px] w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-[440px] w-full rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Dynamic POI Loader on Move/Zoom */}
        <MapEventHandler onMapMove={onMapMove} />

        {/* Smooth Fly-To Controller */}
        <MapFlyController targetCenter={selectedCenter} />

        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={getCategoryIcon(place.category)}
          >
            <Popup>
              <div className="p-1 min-w-[190px]">
                <h4 className="font-bold text-slate-900 text-sm leading-tight">
                  {place.name}
                </h4>

                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-amber-600">
                    ★ {place.rating ? place.rating.toFixed(1) : "—"}
                  </span>
                  <span>•</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
                    {place.priceLevel}
                  </span>
                  <span>•</span>
                  <span className="text-slate-500">{place.category}</span>
                </div>

                {onSelectPlace && (
                  <Button
                    size="sm"
                    onClick={() => onSelectPlace(place.id)}
                    className="mt-2.5 w-full text-xs h-7 gap-1"
                  >
                    <Star className="w-3 h-3 fill-white" />
                    Rate this place
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
