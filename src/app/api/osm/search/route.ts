import { NextResponse } from "next/server";
import { isNominatimResponse, parseNominatimResult } from "@/domain/osm/osm";
import { createMinIntervalLimiter } from "@/domain/osm/rate-limit";
import type { OsmSearchResult } from "@/types/search";

interface CacheEntry {
  timestamp: number;
  data: OsmSearchResult[];
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const MAX_CACHE_ENTRIES = 100;
const searchCache = new Map<string, CacheEntry>();

// Nominatim policy: at most 1 request per second for the whole application (ADR-004).
// The counter lives in the memory of one server instance.
const allowNominatimRequest = createMinIntervalLimiter(1000);

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  // The map area to search in: all four sides or none.
  const [south, west, north, east] = ["south", "west", "north", "east"].map(
    (side) => Number(searchParams.get(side) || NaN) // "" must not become 0
  );
  const area = [south, west, north, east].every(Number.isFinite)
    ? { south, west, north, east }
    : null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 10);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // Rounded to ~1 km so that a small pan still hits the cache.
  const areaKey = area
    ? [area.south, area.west, area.north, area.east]
        .map((n) => n.toFixed(2))
        .join(",")
    : "";
  const cacheKey = `${q.toLowerCase()}:${areaKey}:${limit}`;

  // 1. Check in-memory LRU cache
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // 2. Fetch from Nominatim API. Answers from the cache above do not count towards the limit.
  if (!allowNominatimRequest()) {
    return NextResponse.json([], {
      status: 429,
      headers: { "Retry-After": "1" },
    });
  }

  try {
    const viewbox = area
      ? `&viewbox=${area.west},${area.north},${area.east},${area.south}`
      : "";
    const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=json&addressdetails=1&limit=${limit}${viewbox}`;

    const res = await fetch(endpoint, {
      headers: {
        "User-Agent":
          "LES-Travel-Planner/1.0 (feup-les-group7; educational-project)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const json: unknown = await res.json();
    if (!isNominatimResponse(json)) {
      return NextResponse.json([], { status: 200 });
    }

    const results: OsmSearchResult[] = [];
    for (let i = 0; i < json.length; i++) {
      const parsed = parseNominatimResult(json[i]);
      if (parsed) {
        results.push(parsed);
      }
    }

    // 3. Store in bounded LRU cache
    if (searchCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey) searchCache.delete(oldestKey);
    }
    searchCache.set(cacheKey, { timestamp: Date.now(), data: results });

    return NextResponse.json(results);
  } catch {
    // Return empty results gracefully on timeout or network restrictions
    return NextResponse.json([], { status: 200 });
  }
}
