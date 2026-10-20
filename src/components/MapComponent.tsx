"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet default marker icon configuration
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Minimum place properties required to plot a map pin */
export interface MapPlace {
  id: string;
  name: string;
  category: string;
  priceLevel: string;
  rating: number;
  latitude: number;
  longitude: number;
}

/**
 * Interactive Leaflet map rendering OpenStreetMap tiles and POI markers.
 */
export default function MapComponent({
  places = [],
  center = [41.147, -8.615], // Downtown Porto coordinates
  zoom = 14,
  onSelectPlace,
}: {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  onSelectPlace?: (placeId: string) => void;
}) {
  // Flag ensuring map only renders client-side after DOM mounting
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Placeholder shown during client hydration
  if (!mounted) {
    return (
      <div className="h-[420px] w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-sm relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        {/* OpenStreetMap public tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render markers for each place with valid coordinates */}
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={defaultIcon}
          >
            {/* Interactive popup opening on pin click */}
            <Popup>
              <div className="p-1 min-w-[180px]">
                <h4 className="font-bold text-slate-900 text-sm">{place.name}</h4>

                <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-amber-600">
                    ★ {place.rating ? place.rating.toFixed(1) : "—"}
                  </span>

                  <span>•</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">{place.priceLevel}</span>

                  <span>•</span>
                  <span>{place.category}</span>
                </div>

                {/* Quick action to open review modal for this spot */}
                {onSelectPlace && (
                  <button
                    onClick={() => onSelectPlace(place.id)}
                    className="mt-2.5 w-full text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium py-1.5 px-3 rounded-lg transition-colors cursor-pointer text-center block"
                  >
                    ★ Rate this spot
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
