/**
 * Pure domain module providing geographical calculations, geodesic distances,
 * walking travel estimates and the bounding box type of the map.
 */

export interface GeoBoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Computes great-circle distance between two pairs of coordinates using the Haversine formula.
 * Returns distance in kilometers rounded to 3 decimal places (meter precision).
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Fast path: identical coordinates require no trigonometric operations
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Earth radius in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((R * c).toFixed(3));
}

/**
 * Estimates walking travel time in minutes based on straight-line distance.
 * Default walking speed: 4.5 km/h.
 * Default detour factor: 1.3 (city street grid detour multiplier).
 */
export function estimateWalkingMinutes(
  distanceKm: number,
  walkingSpeedKmh = 4.5,
  detourFactor = 1.3
): number {
  if (distanceKm <= 0) {
    return 0;
  }

  const effectiveDistance = distanceKm * detourFactor;
  const hours = effectiveDistance / walkingSpeedKmh;

  return Math.round(hours * 60);
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Filters places to those inside the map viewport plus a configurable margin.
 *
 * The margin reduces marker updates while panning near viewport boundaries.
 * A margin of 0.15 adds 15% of the viewport size on each side.
 */
export function filterPlacesByBounds<
  T extends { latitude: number; longitude: number },
>(places: T[], bounds: GeoBoundingBox, margin = 0.15): T[] {
  const latBuffer = Math.abs(bounds.north - bounds.south) * margin;
  const lonBuffer = Math.abs(bounds.east - bounds.west) * margin;

  const minLat = bounds.south - latBuffer;
  const maxLat = bounds.north + latBuffer;
  const minLon = bounds.west - lonBuffer;
  const maxLon = bounds.east + lonBuffer;

  return places.filter(
    (place) =>
      place.latitude >= minLat &&
      place.latitude <= maxLat &&
      place.longitude >= minLon &&
      place.longitude <= maxLon
  );
}
