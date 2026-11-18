/**
 * How a stop is sent to the browser (US-E4-01, #60): where it is (day and position), its visit time and
 * the place, with what a day of the itinerary shows, so the page needs no second request for the
 * names. The Stops API and the trip page use this one function, so the stops always look the same.
 */

export interface StopPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: string | null;
}

export interface StopRecord {
  id: string;
  dayId: string;
  placeId: string;
  position: number;
  visitTime: string | null;
  place: StopPlace;
}

export function toStopResponse(stop: StopRecord) {
  return {
    id: stop.id,
    dayId: stop.dayId,
    placeId: stop.placeId,
    position: stop.position,
    visitTime: stop.visitTime,
    place: {
      id: stop.place.id,
      name: stop.place.name,
      category: stop.place.category,
      address: stop.place.address,
      latitude: stop.place.latitude,
      longitude: stop.place.longitude,
      priceLevel: stop.place.priceLevel,
    },
  };
}
