"use client";

/**
 * Loads the Leaflet map (MapComponent) only in the browser, because Leaflet needs `window`,
 * and shows a placeholder while it loads.
 */

import dynamic from "next/dynamic";
import type { MapPlace, BoundingBox, MapAddAction } from "./MapComponent";

/** The height of the map when the page gives none: the trip planner and small screens. */
const DEFAULT_MAP_HEIGHT = "h-[440px]";

export interface MapWrapperProps {
  places?: MapPlace[];
  center?: [number, number];
  zoom?: number;
  selectedCenter?: [number, number] | null;
  selectedCityCenter?: [number, number] | null;
  onSelectPlace?: (placeId: string) => void;
  onMapMove?: (bounds: BoundingBox) => void;
  addAction?: MapAddAction;
  /**
   * Tailwind height classes of the map, 440 px when not given. The home page makes it taller on big
   * screens, so a wide map is not a thin strip (#187).
   */
  heightClassName?: string;
  /** A new list makes the map show all these points at once ("All cities" on the home page, #187). */
  fitPoints?: [number, number][] | null;
}

const DynamicMap = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full animate-pulse items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      Initializing map with OpenStreetMap...
    </div>
  ),
});

export default function MapWrapper({
  heightClassName = DEFAULT_MAP_HEIGHT,
  ...props
}: MapWrapperProps) {
  // The box has the height, so the placeholder and the map are the same size and the page does not jump
  return (
    <div className={heightClassName}>
      <DynamicMap {...props} heightClassName="h-full" />
    </div>
  );
}
