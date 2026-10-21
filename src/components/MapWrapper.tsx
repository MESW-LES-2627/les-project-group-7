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
    <div className="flex h-[440px] w-full animate-pulse items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      Initializing map with OpenStreetMap...
    </div>
  ),
});

export default function MapWrapper(props: MapWrapperProps) {
  return <DynamicMap {...props} />;
}
