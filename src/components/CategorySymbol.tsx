"use client";

/**
 * The icon of a place category. `type` is the icon name given by the category configuration
 * (src/domain/catalog/categories); an unknown name shows a map pin.
 */

import {
  Landmark,
  Utensils,
  Building2,
  Trees,
  Coffee,
  Wine,
  MapPin,
  type LucideProps,
} from "lucide-react";
import type { CategoryIconType } from "@/domain/catalog/categories";

export interface CategorySymbolProps extends LucideProps {
  type: CategoryIconType;
}

export function CategorySymbol({
  type,
  className,
  ...props
}: CategorySymbolProps) {
  switch (type) {
    case "Landmark":
      return <Landmark className={className} {...props} />;
    case "Utensils":
      return <Utensils className={className} {...props} />;
    case "Building2":
      return <Building2 className={className} {...props} />;
    case "Trees":
      return <Trees className={className} {...props} />;
    case "Coffee":
      return <Coffee className={className} {...props} />;
    case "Wine":
      return <Wine className={className} {...props} />;
    default:
      return <MapPin className={className} {...props} />;
  }
}
