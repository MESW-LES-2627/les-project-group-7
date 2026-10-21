"use client";

import dynamic from "next/dynamic";
import type { MapPlace, BoundingBox } from "./MapComponent";

export interface MapWrapperProps {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  selectedCenter?: [number, number] | null;
  onSelectPlace?: (placeId: string) => void;
  onMapMove?: (bounds: BoundingBox) => void;
}

const DynamicMap = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-[440px] w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 animate-pulse">
      Initializing map with OpenStreetMap...
    </div>
  ),
});

export default function MapWrapper(props: MapWrapperProps) {
  return <DynamicMap {...props} />;
}
