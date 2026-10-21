"use client";

import { Star, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PlaceItem } from "./PlaceExplorer";
import { formatPrice } from "./ReviewModal";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { CategorySymbol } from "./CategorySymbol";

export interface PlaceDataTableProps {
  paginatedPlaces: PlaceItem[];
  filteredPlacesCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onSelectMapCenter: (coords: [number, number]) => void;
  onOpenReview: (place: PlaceItem) => void;
}

export default function PlaceDataTable({
  paginatedPlaces,
  filteredPlacesCount,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onSelectMapCenter,
  onOpenReview,
}: PlaceDataTableProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="w-12 py-3 pl-4 pr-2 text-center">#</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-center">Preço</th>
                <th className="px-4 py-3">Classificação</th>
                <th className="py-3 pl-4 pr-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPlaces.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-500"
                  >
                    Nenhum local encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                paginatedPlaces.map((place, index) => {
                  const rank = (currentPage - 1) * pageSize + index + 1;
                  const config = getCategoryConfig(place.category);

                  return (
                    <tr
                      key={place.id}
                      className="group transition-colors hover:bg-slate-50/80"
                    >
                      {/* Rank Position */}
                      <td className="py-3 pl-4 pr-2 text-center font-mono text-xs font-bold text-slate-400 group-hover:text-slate-700">
                        {rank <= 3 ? (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              rank === 1
                                ? "bg-amber-100 text-amber-800"
                                : rank === 2
                                  ? "bg-slate-200 text-slate-700"
                                  : "border border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {rank}
                          </span>
                        ) : (
                          `#${rank}`
                        )}
                      </td>

                      {/* Name & Address */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1 font-semibold text-slate-900">
                            {place.name}
                          </span>
                          {place.isDiscovered && (
                            <Badge
                              variant="outline"
                              className="shrink-0 border-sky-200 bg-sky-50 text-[10px] text-sky-700"
                            >
                              OSM
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {place.address}
                        </p>
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor} ${config.borderColor}`}
                        >
                          <CategorySymbol
                            type={config.iconType}
                            className="h-3.5 w-3.5"
                          />
                          {config.label}
                        </span>
                      </td>

                      {/* Price Level */}
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs shadow-none"
                        >
                          {formatPrice(place.priceLevel)}
                        </Badge>
                      </td>

                      {/* Rating & Reviews */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            {place.averageRating
                              ? place.averageRating.toFixed(1)
                              : "—"}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({place.reviewCount}{" "}
                            {place.reviewCount === 1 ? "review" : "reviews"})
                          </span>
                        </div>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3 pl-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onSelectMapCenter([
                                place.latitude,
                                place.longitude,
                              ]);
                              window.scrollTo({ top: 180, behavior: "smooth" });
                            }}
                            className="h-7 gap-1 px-2.5 text-xs text-slate-700 hover:text-slate-900"
                            title="Centrar no mapa"
                          >
                            <MapPin className="h-3 w-3 text-rose-500" />
                            Mapa
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => onOpenReview(place)}
                            className="h-7 gap-1 px-2.5 text-xs"
                          >
                            <Star className="h-3 w-3 fill-white" />
                            Rate
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
          <span className="text-xs text-slate-500">
            A mostrar {(currentPage - 1) * pageSize + 1} a{" "}
            {Math.min(currentPage * pageSize, filteredPlacesCount)} de{" "}
            {filteredPlacesCount} locais
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
              Anterior
            </Button>

            <span className="px-2 text-xs font-medium text-slate-700">
              Página {currentPage} de {totalPages}
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
              Seguinte
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
