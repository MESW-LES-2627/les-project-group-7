/**
 * Architecture Summary:
 * Pure domain module providing canonical metadata and visual styling definitions
 * for all place categories across the application.
 *
 * Domain Policy:
 * - Symbolic Representation: Uses category icons and cohesive color palettes
 *   instead of speculative or misleading external stock photos.
 */

import { PlaceCategory } from "@prisma/client";

export type CategoryIconType =
  | "Landmark"
  | "Utensils"
  | "Building2"
  | "Trees"
  | "Coffee"
  | "Wine"
  | "MapPin";

export interface CategoryConfig {
  label: string;
  iconType: CategoryIconType;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const CATEGORY_CONFIGS: Record<PlaceCategory, CategoryConfig> = {
  [PlaceCategory.MONUMENT]: {
    label: "Monumento",
    iconType: "Landmark",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-700",
    borderColor: "border-indigo-200",
  },
  [PlaceCategory.RESTAURANT]: {
    label: "Restaurante",
    iconType: "Utensils",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  [PlaceCategory.MUSEUM]: {
    label: "Museu",
    iconType: "Building2",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
  },
  [PlaceCategory.PARK]: {
    label: "Parque",
    iconType: "Trees",
    bgColor: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200",
  },
  [PlaceCategory.CAFE]: {
    label: "Café",
    iconType: "Coffee",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
  },
  [PlaceCategory.BAR]: {
    label: "Bar",
    iconType: "Wine",
    bgColor: "bg-rose-50",
    textColor: "text-rose-700",
    borderColor: "border-rose-200",
  },
  [PlaceCategory.OTHER]: {
    label: "Outro",
    iconType: "MapPin",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
    borderColor: "border-slate-200",
  },
};

/**
 * Returns the canonical visual configuration for a given place category.
 */
export function getCategoryConfig(
  category?: PlaceCategory | string | null
): CategoryConfig {
  if (category && category in CATEGORY_CONFIGS) {
    return CATEGORY_CONFIGS[category as PlaceCategory];
  }
  return CATEGORY_CONFIGS[PlaceCategory.OTHER];
}
