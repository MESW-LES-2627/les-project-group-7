import type { PlaceCategory } from "@prisma/client";

/**
 * Raw or mapped item discovered live from the OpenStreetMap Nominatim API.
 */
export interface OsmSearchResult {
  osmId: string;

  name: string;
  category: PlaceCategory;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  
  wikidataId?: string | null;
}
