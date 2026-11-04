"use client";

/**
 * The city search box and the row of city buttons: "All Cities" plus one per matching city with
 * its number of places. Choosing one tells the explorer which city to show (null means all).
 */

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterCitiesByName } from "@/domain/catalog/city-search";

export interface CityOption {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  count?: number;
}

interface CitySelectorProps {
  cities: CityOption[];
  selectedCityId: string | null;
  onSelectCity: (city: CityOption | null) => void;
}

export default function CitySelector({
  cities,
  selectedCityId,
  onSelectCity,
}: CitySelectorProps) {
  const [query, setQuery] = useState("");
  const matchingCities = filterCitiesByName(cities, query);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city..."
          aria-label="Search a city"
          className="pl-9 text-xs"
        />
      </div>

      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
        <Button
          size="sm"
          variant={selectedCityId === null ? "default" : "outline"}
          onClick={() => onSelectCity(null)}
          className="h-7 shrink-0 rounded-full px-3 text-xs"
        >
          <MapPin className="mr-1 h-3 w-3 text-slate-400" />
          All Cities
        </Button>

        {matchingCities.map((city) => {
          const isSelected = selectedCityId === city.id;

          return (
            <Button
              key={city.id}
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={() => onSelectCity(city)}
              className="h-7 shrink-0 gap-1.5 rounded-full px-3 text-xs"
            >
              <span>{city.name}</span>
              {typeof city.count === "number" && (
                <span
                  className={`py-0.2 rounded-full px-1.5 font-mono text-[10px] ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {city.count}
                </span>
              )}
            </Button>
          );
        })}

        {matchingCities.length === 0 && (
          <span className="shrink-0 px-2 text-xs text-slate-500">
            No cities found for &ldquo;{query.trim()}&rdquo;.
          </span>
        )}
      </div>
    </div>
  );
}
