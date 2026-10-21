"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Star, MapPin, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { CategorySymbol } from "./CategorySymbol";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";

interface PlaceSearchAutocompleteProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  localPlaces: readonly PlaceItem[];
  cityName?: string;
  onSelectLocalPlace: (place: PlaceItem) => void;
  onSelectOsmPlace: (osmPlace: OsmSearchResult) => void;
}

export default function PlaceSearchAutocomplete({
  searchQuery,
  onSearchChange,
  localPlaces,
  cityName,
  onSelectLocalPlace,
  onSelectOsmPlace,
}: PlaceSearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [osmResults, setOsmResults] = useState<OsmSearchResult[]>([]);
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Instant local database search filter (up to 4 matches)
  const matchingLocalPlaces =
    searchQuery.trim().length >= 2
      ? localPlaces
          .filter(
            (p) =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.address.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .slice(0, 4)
      : [];

  // 2. Debounced live OpenStreetMap search
  const fetchOsmSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.trim().length < 2) {
        setOsmResults([]);
        setIsLoadingOsm(false);
        return;
      }

      setIsLoadingOsm(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ q: query });
          if (cityName) params.set("city", cityName);

          const res = await fetch(`/api/osm/search?${params}`);
          if (!res.ok) return;

          const data: unknown = await res.json();
          if (Array.isArray(data)) {
            setOsmResults(data as OsmSearchResult[]);
          }
        } catch {
          setOsmResults([]);
        } finally {
          setIsLoadingOsm(false);
        }
      }, 350);
    },
    [cityName]
  );

  useEffect(() => {
    fetchOsmSearch(searchQuery);
  }, [searchQuery, fetchOsmSearch]);

  // 3. Dismiss dropdown on outside clicks
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = matchingLocalPlaces.length > 0 || osmResults.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Pesquisar locais por nome, morada ou OSM..."
          className="pl-9 pr-8 text-xs"
        />
        {isLoadingOsm && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {isOpen && searchQuery.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          {/* Section A: Catálogo Local */}
          {matchingLocalPlaces.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400">
                <MapPin className="h-3 w-3 text-rose-500" />
                No Catálogo
              </div>
              <div className="space-y-1">
                {matchingLocalPlaces.map((place) => {
                  const config = getCategoryConfig(place.category);

                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => {
                        onSelectLocalPlace(place);
                        setIsOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}
                      >
                        <CategorySymbol
                          type={config.iconType}
                          className={`h-4 w-4 ${config.textColor}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-medium text-slate-800">
                            {place.name}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {place.priceLevel || "€"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          {place.averageRating && (
                            <span className="flex items-center text-amber-600">
                              <Star className="mr-0.5 h-2.5 w-2.5 fill-amber-500" />
                              {place.averageRating.toFixed(1)}
                            </span>
                          )}
                          <span className="truncate">{place.address}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section B: OpenStreetMap Live */}
          {osmResults.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400">
                <Globe className="h-3 w-3 text-sky-500" />
                Descobertos no OpenStreetMap
              </div>
              <div className="space-y-1">
                {osmResults.map((osm) => {
                  const osmConfig = getCategoryConfig(osm.category);

                  return (
                    <button
                      key={`osm-${osm.osmId}`}
                      type="button"
                      onClick={() => {
                        onSelectOsmPlace(osm);
                        setIsOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sky-50/50"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${osmConfig.bgColor}`}
                      >
                        <CategorySymbol
                          type={osmConfig.iconType}
                          className={`h-4 w-4 ${osmConfig.textColor}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-medium text-slate-800">
                            {osm.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-sky-200 bg-sky-50 text-[10px] text-sky-700"
                          >
                            OSM Live
                          </Badge>
                        </div>
                        <p className="truncate text-[11px] text-slate-500">
                          {osm.address}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-sky-600">
                        Ver no mapa →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!hasResults && !isLoadingOsm && (
            <div className="p-3 text-center text-xs text-slate-400">
              Nenhum local encontrado para &ldquo;{searchQuery}&rdquo;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
