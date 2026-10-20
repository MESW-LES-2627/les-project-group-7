"use client";

import dynamic from "next/dynamic";
import type { MapPlace } from "./MapComponent";

// Dynamic import with SSR disabled to avoid browser window hydration errors
const DynamicMap = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 animate-pulse">
      Initializing map with OpenStreetMap...
    </div>
  ),
});

/**
 * SSR-safe dynamic shell for Leaflet map component.
 */
export default function MapWrapper({
  places,
  center,
  zoom,
  onSelectPlace,
}: {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  onSelectPlace?: (placeId: string) => void;
}) {
  return (
    <DynamicMap
      places={places}
      center={center}
      zoom={zoom}
      onSelectPlace={onSelectPlace}
    />
  );
}
