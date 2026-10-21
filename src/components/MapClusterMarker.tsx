"use client";

import { Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapCluster } from "@/domain/catalog/clustering";

const CLUSTER_ICON_CACHE = new Map<number, L.DivIcon>();

export function getClusterIcon(count: number): L.DivIcon {
  const cached = CLUSTER_ICON_CACHE.get(count);
  if (cached) {
    return cached;
  }

  const size = count < 10 ? 32 : count < 50 ? 38 : 44;
  const bgColor = count < 10 ? "#6366f1" : count < 50 ? "#4f46e5" : "#3730a3";

  const icon = L.divIcon({
    className: "custom-cluster-badge",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div style="background-color: ${bgColor}; color: white; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 2.5px solid rgba(255,255,255,0.9); box-shadow: 0 2px 8px rgba(0,0,0,0.28); cursor: pointer;">
        ${count}
      </div>
    `,
  });

  CLUSTER_ICON_CACHE.set(count, icon);
  return icon;
}

export default function MapClusterMarker({ cluster }: { cluster: MapCluster }) {
  const map = useMap();

  return (
    <Marker
      position={[cluster.latitude, cluster.longitude]}
      icon={getClusterIcon(cluster.count)}
      eventHandlers={{
        click: () => {
          map.flyTo(
            [cluster.latitude, cluster.longitude],
            Math.min(17, map.getZoom() + 2),
            {
              duration: 0.5,
            }
          );
        },
      }}
    >
      <Popup>
        <div className="min-w-[150px] p-1">
          <h4 className="text-xs font-bold text-slate-900">
            {cluster.count} locais nesta área
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Clica na bolha para fazer zoom
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
