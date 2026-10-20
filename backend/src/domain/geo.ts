/**
 * Computes great-circle distance between two pairs of coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
  return Math.round(R * c * 1000) / 1000;
}

/**
 * Estimates walking travel time in minutes based on straight-line distance.
 * Default walking speed: 4.5 km/h.
 * Default detour factor: 1.3 (city streets detour ratio).
 */
export function estimateWalkingMinutes(
  distanceKm: number,
  walkingSpeedKmh = 4.5,
  detourFactor = 1.3
): number {
  if (distanceKm <= 0) return 0;
  const effectiveDistance = distanceKm * detourFactor;
  const hours = effectiveDistance / walkingSpeedKmh;
  return Math.round(hours * 60);
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
