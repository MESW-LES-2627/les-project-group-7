import { describe, it, expect } from "vitest";
import { formatDistance, nearbyPlaces, type NearbyCandidate } from "./nearby";

// One degree of latitude is about 111.2 km, so 0.003 degrees north is about 334 m.
const ORIGIN = { latitude: 38.7139, longitude: -9.1394 };

function place(
  id: string,
  northDegrees: number,
  averageRating: number | null,
  category: NearbyCandidate["category"] = "RESTAURANT",
  reviewCount = averageRating === null ? 0 : 20
): NearbyCandidate {
  return {
    id,
    category,
    averageRating,
    reviewCount,
    latitude: ORIGIN.latitude + northDegrees,
    longitude: ORIGIN.longitude,
  };
}

describe("nearbyPlaces: AC1, the best rated first with distance and walking time", () => {
  it("orders by rating, highest first, and gives each place its distance and walking time", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [
        place("ok", 0.005, 4.2),
        place("best", 0.003, 4.8),
        place("low", 0.008, 3.9),
      ],
      { category: null, excludeIds: new Set() }
    );

    expect(
      suggestions.map((s) => [s.place.id, s.distanceKm, s.walkingMinutes])
    ).toEqual([
      ["best", 0.334, 6],
      ["ok", 0.556, 10],
      ["low", 0.89, 15],
    ]);
  });
});

const ANY = { category: null, excludeIds: new Set<string>() };

describe("nearbyPlaces: AC1, places that are tied or not rated yet", () => {
  it("puts places without a rating last, and the nearest first among equal ratings", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [
        place("unrated", 0.001, null),
        place("tie-far", 0.006, 4.5),
        place("lower", 0.004, 4.0),
        place("tie-near", 0.002, 4.5),
      ],
      ANY
    );

    expect(suggestions.map((s) => s.place.id)).toEqual([
      "tie-near",
      "tie-far",
      "lower",
      "unrated",
    ]);
  });

  it("the lowest rating, 1.0, is still above a place that is not rated", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [place("unrated", 0.001, null), place("lowest", 0.004, 1.0)],
      ANY
    );

    expect(suggestions.map((s) => s.place.id)).toEqual(["lowest", "unrated"]);
  });
});

describe("nearbyPlaces: AC2, a type filter", () => {
  const mixed = [
    place("restaurant", 0.003, 4.0, "RESTAURANT"),
    place("museum", 0.002, 4.9, "MUSEUM"),
    place("cafe", 0.004, 4.5, "CAFE"),
  ];

  it("shows only the places of that type", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, mixed, {
      ...ANY,
      category: "RESTAURANT",
    });

    expect(suggestions.map((s) => s.place.id)).toEqual(["restaurant"]);
  });

  it("shows every type when no type is chosen", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, mixed, ANY);

    expect(suggestions.map((s) => s.place.id)).toEqual([
      "museum",
      "cafe",
      "restaurant",
    ]);
  });

  it("a type with no place near gives an empty list", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, mixed, {
      ...ANY,
      category: "PARK",
    });

    expect(suggestions).toEqual([]);
  });
});

describe("nearbyPlaces: AC5, places already in the trip", () => {
  const candidates = [
    place("stop", 0, 5.0),
    place("planned", 0.002, 4.8),
    place("free", 0.003, 4.0),
  ];

  it("does not suggest them, and the place of the stop itself is one of them", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, candidates, {
      ...ANY,
      excludeIds: new Set(["stop", "planned"]),
    });

    expect(suggestions.map((s) => s.place.id)).toEqual(["free"]);
  });

  it("an id that is not among the candidates changes nothing", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, candidates, {
      ...ANY,
      excludeIds: new Set(["somewhere-else"]),
    });

    expect(suggestions.map((s) => s.place.id)).toEqual([
      "stop",
      "planned",
      "free",
    ]);
  });

  it("works together with the type filter", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [
        place("a", 0.002, 4.0, "CAFE"),
        place("b", 0.003, 4.5, "CAFE"),
        place("c", 0.001, 5.0, "MUSEUM"),
      ],
      { category: "CAFE", excludeIds: new Set(["b"]) }
    );

    expect(suggestions.map((s) => s.place.id)).toEqual(["a"]);
  });

  it("does not change the list it receives", () => {
    const ids = new Set(["stop"]);
    const before = candidates.map((c) => c.id);

    nearbyPlaces(ORIGIN, candidates, { ...ANY, excludeIds: ids });

    expect(candidates.map((c) => c.id)).toEqual(before);
    expect([...ids]).toEqual(["stop"]);
  });
});

// 0.0135 degrees north is about 1.5 km, 0.0089 about 0.99 km and 0.0091 about 1.01 km.
describe("nearbyPlaces: AC6, 1 km, or 2 km when fewer than 3 places are within 1 km", () => {
  const withinOneKm = [
    place("a", 0.002, 3.0),
    place("b", 0.004, 3.5),
    place("c", 0.006, 4.0),
  ];
  const at1500m = place("far", 0.0135, 5.0);

  it("keeps 1 km when 3 places are within it, and leaves out the one at 1.5 km", () => {
    const result = nearbyPlaces(ORIGIN, [...withinOneKm, at1500m], ANY);

    expect(result.radiusKm).toBe(1);
    expect(result.suggestions.map((s) => s.place.id)).toEqual(["c", "b", "a"]);
  });

  it("widens to 2 km when only 2 places are within 1 km, and ranks all of them together", () => {
    const result = nearbyPlaces(
      ORIGIN,
      [withinOneKm[0], withinOneKm[1], at1500m],
      ANY
    );

    expect(result.radiusKm).toBe(2);
    expect(result.suggestions.map((s) => s.place.id)).toEqual([
      "far",
      "b",
      "a",
    ]);
  });

  it("widens to 2 km when nothing is within 1 km", () => {
    const result = nearbyPlaces(ORIGIN, [at1500m], ANY);

    expect(result.radiusKm).toBe(2);
    expect(result.suggestions.map((s) => s.place.id)).toEqual(["far"]);
  });

  it("a place at 0.99 km counts as within 1 km, one at 1.01 km does not", () => {
    const inside = [
      place("i1", 0.0089, 3.0),
      place("i2", 0.002, 3.0),
      place("i3", 0.003, 3.0),
    ];
    const outside = [
      place("o1", 0.0091, 3.0),
      place("i2", 0.002, 3.0),
      place("i3", 0.003, 3.0),
    ];

    expect(nearbyPlaces(ORIGIN, inside, ANY).radiusKm).toBe(1);
    expect(nearbyPlaces(ORIGIN, outside, ANY).radiusKm).toBe(2);
  });

  it("counts only the places that are left after the type filter", () => {
    const places = [
      place("r1", 0.002, 4.0, "RESTAURANT"),
      place("r2", 0.003, 4.0, "RESTAURANT"),
      place("m1", 0.004, 4.0, "MUSEUM"),
      place("m2", 0.005, 4.0, "MUSEUM"),
      place("r-far", 0.0135, 4.5, "RESTAURANT"),
    ];

    expect(nearbyPlaces(ORIGIN, places, ANY).radiusKm).toBe(1);

    const restaurants = nearbyPlaces(ORIGIN, places, {
      ...ANY,
      category: "RESTAURANT",
    });

    expect(restaurants.radiusKm).toBe(2);
    expect(restaurants.suggestions.map((s) => s.place.id)).toEqual([
      "r-far",
      "r1",
      "r2",
    ]);
  });

  it("counts only the places that are left after the trip places are taken out", () => {
    const result = nearbyPlaces(ORIGIN, [...withinOneKm, at1500m], {
      ...ANY,
      excludeIds: new Set(["a"]),
    });

    expect(result.radiusKm).toBe(2);
    expect(result.suggestions.map((s) => s.place.id)).toEqual([
      "far",
      "c",
      "b",
    ]);
  });
});

// 0.0179 degrees north is about 1.99 km, 0.018 about 2.0015 km and 0.0225 about 2.5 km.
describe("nearbyPlaces: AC4, no place is near", () => {
  it("gives an empty list when there are no places at all", () => {
    expect(nearbyPlaces(ORIGIN, [], ANY)).toEqual({
      radiusKm: 2,
      suggestions: [],
    });
  });

  it("gives an empty list when every place is beyond 2 km", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [place("x", 0.0225, 5.0), place("y", 0.05, 5.0)],
      ANY
    );

    expect(suggestions).toEqual([]);
  });

  it("2 km is the end: a place at 1.99 km is suggested, one at 2.0015 km is not", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [place("in", 0.0179, 4.0), place("out", 0.018, 5.0)],
      ANY
    );

    expect(suggestions.map((s) => s.place.id)).toEqual(["in"]);
  });

  it("a place beyond 2 km is never suggested, even when it is the only one of the type", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [place("park", 0.0225, 5.0, "PARK"), place("cafe", 0.002, 3.0, "CAFE")],
      { ...ANY, category: "PARK" }
    );

    expect(suggestions).toEqual([]);
  });

  it("an empty list when everything is excluded", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, [place("only", 0.002, 4.0)], {
      ...ANY,
      excludeIds: new Set(["only"]),
    });

    expect(suggestions).toEqual([]);
  });
});

describe("nearbyPlaces: a place right at the stop", () => {
  it("is 0 km and 0 minutes away", () => {
    const { suggestions } = nearbyPlaces(ORIGIN, [place("here", 0, 4.0)], ANY);

    expect(suggestions[0]).toMatchObject({ distanceKm: 0, walkingMinutes: 0 });
  });
});

// 0.00899 degrees north is 1.000 km (distances are rounded to the meter), and 0.017986 is 2.000 km.
describe("nearbyPlaces: the distances of exactly 1 km and 2 km", () => {
  it("a place at exactly 1 km is within 1 km", () => {
    const places = [
      place("a", 0.002, 3.0),
      place("b", 0.003, 3.0),
      place("edge", 0.00899, 3.0),
    ];
    const result = nearbyPlaces(ORIGIN, places, ANY);

    expect(
      result.suggestions.find((s) => s.place.id === "edge")?.distanceKm
    ).toBe(1);
    expect(result.radiusKm).toBe(1);
    expect(result.suggestions).toHaveLength(3);
  });

  it("a place at exactly 2 km is still suggested", () => {
    const result = nearbyPlaces(ORIGIN, [place("edge", 0.017986, 4.0)], ANY);

    expect(result.suggestions.map((s) => [s.place.id, s.distanceKm])).toEqual([
      ["edge", 2],
    ]);
  });
});

describe("nearbyPlaces: the order does not depend on the order of the input", () => {
  const rated = [place("r1", 0.002, 4.0), place("r2", 0.003, 4.5)];
  const unrated = place("u", 0.001, null);

  it.each([
    [[rated[0], rated[1], unrated]],
    [[rated[0], unrated, rated[1]]],
    [[unrated, rated[0], rated[1]]],
    [[unrated, rated[1], rated[0]]],
    [[rated[1], unrated, rated[0]]],
    [[rated[1], rated[0], unrated]],
  ])(
    "rated places by rating, then the unrated one, for any input order",
    (input) => {
      const { suggestions } = nearbyPlaces(ORIGIN, input, ANY);

      expect(suggestions.map((s) => s.place.id)).toEqual(["r2", "r1", "u"]);
    }
  );
});

describe("nearbyPlaces: AC1, the rating is the weighted rating of ADR-008", () => {
  it("one review of 5.0 does not outrank 50 reviews averaging 4.8", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [
        place("one-review", 0.002, 5.0, "RESTAURANT", 1),
        place("many", 0.004, 4.8, "RESTAURANT", 50),
      ],
      ANY
    );

    expect(suggestions.map((s) => s.place.id)).toEqual(["many", "one-review"]);
  });

  it("a place with an average but no review count is not ranked", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [
        place("no-count", 0.002, 5.0, "RESTAURANT", 0),
        place("rated", 0.004, 3.0),
      ],
      ANY
    );

    expect(suggestions.map((s) => s.place.id)).toEqual(["rated", "no-count"]);
  });
});

describe("nearbyPlaces: the score of each suggestion", () => {
  it("gives the weighted rating (ADR-008) that was used to rank it, or null when it is not rated", () => {
    const { suggestions } = nearbyPlaces(
      ORIGIN,
      [
        place("one-review", 0.002, 5.0, "RESTAURANT", 1),
        place("unrated", 0.003, null),
      ],
      ANY
    );

    expect(suggestions.map((s) => [s.place.id, s.score])).toEqual([
      ["one-review", 4.14],
      ["unrated", null],
    ]);
  });
});

describe("formatDistance: how a distance is shown next to a suggestion", () => {
  it.each([
    [0, "0 m"],
    [0.0004, "0 m"],
    [0.0006, "1 m"],
    [0.334, "334 m"],
    [0.999, "999 m"],
    [0.9996, "1.0 km"],
    [1, "1.0 km"],
    [1.24, "1.2 km"],
    [1.25, "1.3 km"],
    [1.99, "2.0 km"],
    [2, "2.0 km"],
  ])("%s km is shown as %s", (km, text) => {
    expect(formatDistance(km)).toBe(text);
  });
});
