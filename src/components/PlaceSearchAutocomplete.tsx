"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Star, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { type GeoBoundingBox } from "@/domain/catalog/geo";
import type { CityOption } from "./CitySelector";
import { CategorySymbol } from "./CategorySymbol";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";

interface PlaceSearchAutocompleteProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  localPlaces: readonly PlaceItem[];
  cities: readonly CityOption[];
  onSelectCity: (city: CityOption) => void;
  onAddCity: (city: CityOption) => void;
  /** The button is shown only with a session: the server refuses the request without one. */
  canAddCity: boolean;
  /** The part of the map on screen: the OpenStreetMap search ranks results inside it first. The catalog is searched everywhere. */
  bounds?: GeoBoundingBox | null;
  onSelectLocalPlace: (place: PlaceItem) => void;
  onSelectOsmPlace: (osmPlace: OsmSearchResult) => void;
}

// Nominatim allows 1 request per second for the whole app and forbids a request per key press.
const OSM_PAUSE_MS = 1000;
const OSM_MIN_CHARS = 3;

// Lower case without accents, so "sao" finds "São".
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default function PlaceSearchAutocomplete({
  searchQuery,
  onSearchChange,
  localPlaces,
  cities,
  onSelectCity,
  onAddCity,
  canAddCity,
  bounds,
  onSelectLocalPlace,
  onSelectOsmPlace,
}: PlaceSearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [osmResults, setOsmResults] = useState<OsmSearchResult[]>([]);
  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  // The text the OpenStreetMap results belong to.
  const [submittedQuery, setSubmittedQuery] = useState("");
  // True when the server refused the last search because of the Nominatim rate limit.
  const [osmBusy, setOsmBusy] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  // Only the answer to the latest submit may update the results.
  const requestIdRef = useRef(0);
  const searchedRef = useRef("");

  // 1. Matches in the whole catalog for the searched text: cities by name, places that have the
  // text in their name or are in a city with that name. Never the street address ("Praça de Lisboa"
  // in Porto is not Lisbon).
  const searched = normalize(searchQuery.trim());
  const matchingCities =
    searched.length >= 2
      ? cities.filter((c) => normalize(c.name).includes(searched))
      : [];
  const matchingLocalPlaces =
    searched.length >= 2
      ? [
          ...localPlaces.filter((p) => normalize(p.name).includes(searched)),
          ...localPlaces.filter(
            (p) =>
              !normalize(p.name).includes(searched) &&
              p.city &&
              normalize(p.city.name).includes(searched)
          ),
        ].slice(0, 5)
      : [];

  // 2. Search OpenStreetMap (Nominatim). The catalog above answers on every key; this one runs
  // when typing pauses (OSM_PAUSE_MS), or at once on the Search button or Enter (ADR-004).
  const submitOsmSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (query.length < 2) return;

    const requestId = ++requestIdRef.current;
    searchedRef.current = query;
    setSubmittedQuery(query);
    setIsOpen(true);
    setOsmBusy(false);
    setIsLoadingOsm(true);
    try {
      const params = new URLSearchParams({ q: query });
      if (bounds) {
        params.set("south", String(bounds.south));
        params.set("west", String(bounds.west));
        params.set("north", String(bounds.north));
        params.set("east", String(bounds.east));
      }

      const res = await fetch(`/api/osm/search?${params}`);
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) {
        setOsmResults([]);
        setOsmBusy(res.status === 429);
        return;
      }

      const data: unknown = await res.json();
      if (requestId !== requestIdRef.current) return;
      setOsmResults(Array.isArray(data) ? (data as OsmSearchResult[]) : []);
    } catch {
      if (requestId === requestIdRef.current) setOsmResults([]);
    } finally {
      if (requestId === requestIdRef.current) setIsLoadingOsm(false);
    }
  }, [searchQuery, bounds]);

  async function addCity(osm: OsmSearchResult) {
    setAddMessage("");
    try {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: osm.name,
          country: osm.country,
          latitude: osm.latitude,
          longitude: osm.longitude,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddMessage(data.error ?? "Could not add the city, try again");
        return;
      }
      onAddCity(data.city);
      setIsOpen(false);
    } catch {
      setAddMessage("Could not reach the server, try again");
    }
  }

  // Typing pause: search OpenStreetMap once the text has not changed for OSM_PAUSE_MS.
  const submitRef = useRef(submitOsmSearch);
  submitRef.current = submitOsmSearch;
  useEffect(() => {
    if (searchQuery.trim().length < OSM_MIN_CHARS) return;
    const timer = setTimeout(() => {
      // Enter or the Search button may have searched this text already: a second request
      // would hit the 1 request per second limit and discard the first answer.
      if (searchedRef.current !== searchQuery.trim()) void submitRef.current();
    }, OSM_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // The OpenStreetMap results belong to the text they were searched for, not to what is typed now.
  const osmIsCurrent = submittedQuery === searchQuery.trim();
  const shownOsmResults = osmIsCurrent ? osmResults : [];
  const hasResults =
    matchingCities.length > 0 ||
    matchingLocalPlaces.length > 0 ||
    shownOsmResults.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitOsmSearch();
              }
            }}
            placeholder="Search places or cities..."
            className="pl-9 pr-8 text-xs"
          />
          {isLoadingOsm && (
            <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={isLoadingOsm || searchQuery.trim().length < 2}
          onClick={() => void submitOsmSearch()}
        >
          Search
        </Button>
      </div>

      {isOpen && searchQuery.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          {/* Section 0: Cities */}
          {matchingCities.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400">
                <MapPin className="h-3 w-3 text-rose-500" />
                Cities
              </div>
              {matchingCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    onSelectCity(city);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md p-1.5 text-left text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50"
                >
                  <span>
                    {city.name}, {city.country}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Go to city →
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Section A: Local catalog */}
          {matchingLocalPlaces.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400">
                <MapPin className="h-3 w-3 text-rose-500" />
                In the catalog
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

          {/* Section B: OpenStreetMap Live (shown only for the submitted text) */}
          {shownOsmResults.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-400">
                <Globe className="h-3 w-3 text-sky-500" />
                Found on OpenStreetMap
              </div>
              <div className="space-y-1">
                {shownOsmResults.map((osm) => {
                  const osmConfig = getCategoryConfig(osm.category);

                  const canAdd =
                    canAddCity &&
                    osm.isCity &&
                    !cities.some(
                      (c) =>
                        normalize(c.name) === normalize(osm.name) &&
                        normalize(c.country) === normalize(osm.country ?? "")
                    );

                  return (
                    <div key={`osm-${osm.osmId}`} className="flex items-center">
                      <button
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
                          Go to map →
                        </span>
                      </button>
                      {canAdd && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-1 shrink-0"
                          onClick={() => void addCity(osm)}
                        >
                          + Add city
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {addMessage && (
            <div
              role="alert"
              className="px-2 py-1.5 text-center text-[11px] text-red-600"
            >
              {addMessage}
            </div>
          )}

          {osmIsCurrent && osmBusy && !isLoadingOsm && (
            <div className="px-2 py-1.5 text-center text-[11px] text-amber-600">
              OpenStreetMap search is busy, trying again when you stop typing.
            </div>
          )}

          {osmIsCurrent && !osmBusy && !hasResults && !isLoadingOsm && (
            <div className="p-3 text-center text-xs text-slate-400">
              No places found for &ldquo;{searchQuery.trim()}&rdquo;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
