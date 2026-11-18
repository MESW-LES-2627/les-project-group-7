/**
 * How a stop is sent to the browser (US-E4-01, #60). The Stops API and, later, the trip page use this
 * one function, so the stops always look the same.
 */

export interface StopRecord {
  id: string;
  dayId: string;
  placeId: string;
  position: number;
  visitTime: string | null;
}

export function toStopResponse(stop: StopRecord) {
  return {
    id: stop.id,
    dayId: stop.dayId,
    placeId: stop.placeId,
    position: stop.position,
    visitTime: stop.visitTime,
  };
}
