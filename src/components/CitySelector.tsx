"use client";

/**
 * The row of city buttons: "All cities" plus one per city with its number of places. Choosing one tells the explorer which city to show (null means all).
 */

import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  return (
    <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
      <Button
        size="sm"
        variant={selectedCityId === null ? "default" : "outline"}
        onClick={() => onSelectCity(null)}
        className="h-7 shrink-0 rounded-full px-3 text-xs"
      >
        <MapPin className="mr-1 h-3 w-3 text-slate-400" />
        All cities
      </Button>

      {cities.map((city) => {
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
    </div>
  );
}
