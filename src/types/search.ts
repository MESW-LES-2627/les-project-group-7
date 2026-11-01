import type { PlaceCategory } from "@prisma/client";
import type { GeoBoundingBox } from "@/domain/catalog/geo";

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
  /** The area the result covers: a whole city or country, or a few metres for a shop. */
  boundingBox?: GeoBoundingBox;
  /** Set only for a city or town: it can be added to the cities of the catalog. */
  isCity?: boolean;
  country?: string;
}
