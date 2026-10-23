import type { PlaceCategory } from "@prisma/client";

export interface PlaceItem {
    
  id: string;
  cityId?: string | null;
  osmId?: string | null;

  name: string;
  category: PlaceCategory;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel?: string | null;
  description?: string | null;
  averageRating: number | null;
  reviewCount: number;
  city?: { name: string; country: string };
  
  isVisited?: boolean;
  isDiscovered?: boolean;
}
