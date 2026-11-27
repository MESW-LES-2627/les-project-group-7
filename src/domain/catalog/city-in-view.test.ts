import { describe, it, expect } from "vitest";
import { cityInView } from "./city-in-view";

const CITIES = [
  { id: "city-porto", latitude: 41.1579, longitude: -8.6291 },
  { id: "city-paris", latitude: 48.8566, longitude: 2.3522 },
  { id: "city-berlim", latitude: 52.52, longitude: 13.405 },
];

/** A map area of about `km` across, centred on a point (1 degree of latitude is about 111 km). */
function around(lat: number, lng: number, km: number) {
  const dLat = km / 2 / 111;
  const dLng = km / 2 / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

describe("cityInView: the city the home map shows (#187)", () => {
  it("is the city whose centre is near the middle of a close map", () => {
    expect(cityInView(around(41.15, -8.61, 20), CITIES)).toBe("city-porto");
    expect(cityInView(around(48.86, 2.35, 20), CITIES)).toBe("city-paris");
  });

  it("is still that city a little away from its centre, like Matosinhos or Vila Nova de Gaia for Porto", () => {
    expect(cityInView(around(41.18, -8.69, 15), CITIES)).toBe("city-porto");
    expect(cityInView(around(41.12, -8.6, 15), CITIES)).toBe("city-porto");
  });

  it("is no city, all cities, when the middle is far from every city", () => {
    expect(cityInView(around(45.0, -1.0, 20), CITIES)).toBeNull();
    // about 40 km from the centre of Porto
    expect(cityInView(around(41.5, -8.6, 20), CITIES)).toBeNull();
  });

  it("is no city when the map is zoomed out past one city, even over it", () => {
    expect(cityInView(around(41.15, -8.61, 61), CITIES)).toBeNull();
    expect(cityInView(around(48.86, 2.35, 900), CITIES)).toBeNull();
  });

  it("is the city up to about 60 km across", () => {
    expect(cityInView(around(41.15, -8.61, 59), CITIES)).toBe("city-porto");
  });

  it("measures across the wider side of the map, which is the width on a wide screen", () => {
    const wide = { ...around(41.15, -8.61, 20), ...{ west: -9.1, east: -8.1 } };

    expect(cityInView(wide, CITIES)).toBeNull();
  });

  it("is no city when there are no cities", () => {
    expect(cityInView(around(41.15, -8.61, 20), [])).toBeNull();
  });
});
