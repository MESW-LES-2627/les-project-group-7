"use client";

/**
 * The ranking as cards: the same places as PlaceDataTable (category banner, name, price, rating,
 * map and rate buttons) with the same page controls.
 */

import Link from "next/link";
import { Star, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import type { PlaceItem } from "./PlaceExplorer";
import { formatPriceLevel } from "@/domain/reviews/rating";
import { formatAverageRating } from "@/domain/catalog/place-details";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { CategorySymbol } from "./CategorySymbol";

export interface PlaceGridProps {
  paginatedPlaces: PlaceItem[];
  filteredPlacesCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onSelectMapCenter: (coords: [number, number]) => void;
  onOpenReview: (place: PlaceItem) => void;
}

export default function PlaceGrid({
  paginatedPlaces,
  filteredPlacesCount,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onSelectMapCenter,
  onOpenReview,
}: PlaceGridProps) {
  if (paginatedPlaces.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No places found with the current filters.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paginatedPlaces.map((place) => {
          const config = getCategoryConfig(place.category);

          return (
            <Card
              key={place.id}
              className="group flex flex-col justify-between overflow-hidden border-slate-200/80 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div>
                {/* Symbolic Category Banner */}
                <div
                  className={`relative flex h-24 w-full items-center justify-center border-b ${config.bgColor} ${config.borderColor}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <CategorySymbol
                      type={config.iconType}
                      className={`h-7 w-7 ${config.textColor}`}
                    />
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${config.textColor}`}
                    >
                      {config.label}
                    </span>
                  </div>

                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {place.isDiscovered && (
                      <Badge
                        variant="outline"
                        className="border-sky-200 bg-sky-50 text-[10px] text-sky-700 shadow-sm"
                      >
                        OSM
                      </Badge>
                    )}
                    {place.isVisited && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 shadow-sm"
                      >
                        Visited
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="font-mono text-[11px] shadow-sm"
                    >
                      {formatPriceLevel(place.priceLevel)}
                    </Badge>
                  </div>
                </div>

                <CardHeader className="p-4 pb-2">
                  <CardTitle className="line-clamp-1 text-sm font-semibold text-slate-900">
                    {!place.isDiscovered ? (
                      <Link
                        href={`/places/${place.id}`}
                        className="hover:underline"
                      >
                        {place.name}
                      </Link>
                    ) : (
                      place.name
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {place.description || place.address}
                  </CardDescription>
                </CardHeader>
              </div>

              <CardFooter className="flex items-center justify-between border-t border-slate-100 p-4 pt-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {formatAverageRating(place.averageRating)}
                    </span>
                    <span className="text-slate-400">
                      ({place.reviewCount}{" "}
                      {place.reviewCount === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onSelectMapCenter([place.latitude, place.longitude]);
                      window.scrollTo({ top: 180, behavior: "smooth" });
                    }}
                    className="h-8 gap-1 text-xs text-slate-700 hover:text-slate-900"
                    title="Center on map"
                  >
                    <MapPin className="h-3 w-3 text-rose-500" />
                    Map
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => onOpenReview(place)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Star className="h-3.5 w-3.5 fill-white" />
                    Rate
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
          <span className="text-xs text-slate-500">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredPlacesCount)} of{" "}
            {filteredPlacesCount} places
          </span>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>

            <span className="px-2 text-xs font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              className="h-8 gap-1 text-xs"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
