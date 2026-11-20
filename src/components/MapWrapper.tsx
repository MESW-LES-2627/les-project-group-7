"use client";

/**
 * Loads the Leaflet map (MapComponent) only in the browser, because Leaflet needs `window`,
 * and shows a placeholder while it loads.
 */

import dynamic from "next/dynamic";
import type { MapPlace, BoundingBox, MapAddAction } from "./MapComponent";

export interface MapWrapperProps {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  selectedCenter?: [number, number] | null;
  selectedCityCenter?: [number, number] | null;
  onSelectPlace?: (placeId: string) => void;
  onMapMove?: (bounds: BoundingBox) => void;
  addAction?: MapAddAction;
}

const DynamicMap = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-full animate-pulse items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      Initializing map with OpenStreetMap...
    </div>
  ),
});

export default function MapWrapper(props: MapWrapperProps) {
  return <DynamicMap {...props} />;
}
