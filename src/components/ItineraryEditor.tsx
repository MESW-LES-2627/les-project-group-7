"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import MapWrapper from "@/components/MapWrapper";
import NearbySuggestions, {
  NEARBY_TYPE_FILTER_ID,
} from "@/components/NearbySuggestions";
import PlannerSavedPlaces from "@/components/PlannerSavedPlaces";
import { useSavedPlaces } from "@/components/SavedPlacesProvider";
import PlaceSearchAutocomplete from "@/components/PlaceSearchAutocomplete";
import { getCategoryConfig } from "@/domain/catalog/categories";
import {
  formatAverageRating,
  formatReviewCount,
} from "@/domain/catalog/place-details";
import {
  ALREADY_PLANNED_MESSAGE,
  addStopBody,
  mapCenter,
  moveOption,
  stopMapPins,
  stopsByDay,
  type AddablePlace,
  type EditorDay,
  type EditorStop,
  type StopMove,
} from "@/domain/itinerary/itinerary-editor";
import { discoveredPlaceId } from "@/domain/osm/osm";
import { formatDayLabel } from "@/domain/trips/trip-labels";
import {
  addStop,
  fetchStops,
  removeStop,
  updateStop,
  type UpdateStopBody,
} from "@/lib/itinerary-stops";
import type { PlaceItem } from "@/types/place";
import type { OsmSearchResult } from "@/types/search";

interface ItineraryEditorProps {
  tripId: string;
  cityName: string;
  days: EditorDay[];
  initialStops: EditorStop[];
  cityPlaces: PlaceItem[];
}

const SEARCH_INPUT_ID = "itinerary-place-search";

type FinderTab = "search" | "saved" | "map" | "nearby";

const addButtonId = (dayId: string) => `add-to-day-${dayId}`;

function toAddable(place: PlaceItem): AddablePlace {
  return {
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
    category: place.category,
    priceLevel: place.priceLevel,
  };
}

const MOVES: {
  move: StopMove;
  label: string;
  Icon: typeof ChevronUp;
}[] = [
  { move: "up", label: "Move up", Icon: ChevronUp },
  { move: "down", label: "Move down", Icon: ChevronDown },
  {
    move: "previous-day",
    label: "Move to the previous day",
    Icon: ChevronLeft,
  },
  { move: "next-day", label: "Move to the next day", Icon: ChevronRight },
];

export default function ItineraryEditor({
  tripId,
  cityName,
  days,
  initialStops,
  cityPlaces,
}: ItineraryEditorProps) {
  const router = useRouter();
  const [stops, setStops] = useState(initialStops);
  const [timeDrafts, setTimeDrafts] = useState<Record<string, string>>({});
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  // The page opens on the first day that has stops: a trip planned from Day 2 on should not open on an empty day.
  const [targetDayId, setTargetDayId] = useState(
    (
      days.find((day) => initialStops.some((stop) => stop.dayId === day.id)) ??
      days[0]
    )?.id ?? ""
  );
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [addTime, setAddTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [finder, setFinder] = useState<FinderTab>("map");
  const [nearbyStopId, setNearbyStopId] = useState<string | null>(null);
  const hasSavedPlaces = useSavedPlaces() !== null;

  // The day to add to has to be a day the trip has now: the dates can change under this page (the Edit trip
  // dialog), and a day that is gone must not be sent.
  const activeDayId = days.some((day) => day.id === targetDayId)
    ? targetDayId
    : (days[0]?.id ?? "");

  const byDay = stopsByDay(days, stops);
  const pins = stopMapPins(stops, cityPlaces);
  const center = mapCenter(stops.length > 0 ? stopMapPins(stops) : cityPlaces);
  const plannedCount = new Set(stops.map((stop) => stop.placeId)).size;
  const unsavedTimes = stops.filter((stop) => stop.id in timeDrafts);

  // The page reads the stops again when something else changes the trip (router.refresh): take them, and
  // forget the unsaved times of stops that are gone.
  useEffect(() => {
    setStops(initialStops);
    setTimeDrafts((drafts) =>
      Object.fromEntries(
        Object.entries(drafts).filter(([id]) =>
          initialStops.some((stop) => stop.id === id)
        )
      )
    );
  }, [initialStops]);

  // Moves the focus after an action, once the controls are enabled again: a button that was disabled while
  // saving loses the focus, and a keyboard user would have to tab from the top of the page again.
  useEffect(() => {
    if (focusTarget && !busy) {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    }
  }, [focusTarget, busy]);

  useEffect(() => {
    if (unsavedTimes.length === 0) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedTimes.length]);
  const dayLabel = (dayId: string) => {
    const day = days.find((item) => item.id === dayId);
    return day ? `Day ${day.dayNumber}` : "the day";
  };

  async function run(
    action: () => Promise<
      | { ok: true; stops?: EditorStop[] }
      | { ok: false; message: string; reload: boolean }
    >,
    done: string,
    onSuccess?: () => void
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    setStatus("");

    const result = await action();

    if (result.ok) {
      if (result.stops) setStops(result.stops);
      onSuccess?.();
      setStatus(done);
    } else {
      setError(result.message);
      if (result.reload) {
        const fresh = await fetchStops(tripId);
        if (fresh.ok) setStops(fresh.stops);
      }
    }

    setBusy(false);
    return result.ok;
  }

  function add(place: AddablePlace) {
    if (!activeDayId) return;

    void run(
      () => addStop(tripId, addStopBody(activeDayId, place, addTime || null)),
      `${place.name} was added to ${dayLabel(activeDayId)}.`,
      () => {
        setSearchQuery("");
        setAddTime("");
        setFocusTarget(SEARCH_INPUT_ID);
      }
    );
  }

  function addLocalPlace(place: PlaceItem) {
    add(toAddable(place));
  }

  // A suggestion goes to the day of the stop it was suggested for, whatever day is open now, and it has no
  // time: the person sets it in the day.
  function addNearby(placeId: string) {
    const place = cityPlaces.find((item) => item.id === placeId);
    if (!place || !nearbyStop) return;

    void run(
      () =>
        addStop(tripId, addStopBody(nearbyStop.dayId, toAddable(place), null)),
      `${place.name} was added to ${dayLabel(nearbyStop.dayId)}.`,
      () => setFocusTarget(NEARBY_TYPE_FILTER_ID)
    );
  }

  function openNearby(stop: EditorStop) {
    setNearbyStopId(stop.id);
    setFinder("nearby");
    setFocusTarget(NEARBY_TYPE_FILTER_ID);
  }

  function addFromMap(placeId: string) {
    const place = cityPlaces.find((item) => item.id === placeId);
    // A pin that is not in the catalog is a place found on OpenStreetMap, and it is on the trip already.
    if (place) addLocalPlace(place);
    else setError(ALREADY_PLANNED_MESSAGE);
  }

  function addSavedPlace(placeId: string) {
    const place = cityPlaces.find((item) => item.id === placeId);
    if (place) addLocalPlace(place);
  }

  function addOsmPlace(place: OsmSearchResult) {
    add({
      id: discoveredPlaceId(place.osmId),
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      category: place.category,
    });
  }

  // "Add a place" in a day: the search opens in the panel next to the plan, with the focus in its box.
  function openSearch() {
    setFinder("search");
    setFocusTarget(SEARCH_INPUT_ID);
  }

  function change(stop: EditorStop, body: UpdateStopBody, done: string) {
    return run(() => updateStop(tripId, stop.id, body), done);
  }

  function forgetDraft(stopId: string) {
    setTimeDrafts(({ [stopId]: _, ...rest }) => rest);
  }

  function typeTime(stop: EditorStop, value: string) {
    if (value === (stop.visitTime ?? "")) {
      forgetDraft(stop.id);
    } else {
      setTimeDrafts((current) => ({ ...current, [stop.id]: value }));
    }
  }

  async function saveTime(stop: EditorStop, value: string): Promise<boolean> {
    const visitTime = value === "" ? null : value;
    const ok = await change(
      stop,
      { visitTime },
      visitTime
        ? `${stop.place.name} is at ${visitTime}.`
        : `${stop.place.name} has no time now.`
    );
    // On success the field shows the new saved time; on a refusal it goes back to the saved one.
    forgetDraft(stop.id);
    return ok;
  }

  async function saveTrip() {
    for (const stop of unsavedTimes) {
      if (!(await saveTime(stop, timeDrafts[stop.id] ?? ""))) return;
    }

    setLeaving(true);
    router.push("/trips");
    router.refresh();
  }

  function remove(stop: EditorStop) {
    void run(
      () => removeStop(tripId, stop.id),
      `${stop.place.name} was removed from ${dayLabel(stop.dayId)}.`,
      () => {
        forgetDraft(stop.id);
        setFocusTarget(addButtonId(stop.dayId));
        setStops((current) =>
          current
            .filter((item) => item.id !== stop.id)
            .map((item) =>
              item.dayId === stop.dayId && item.position > stop.position
                ? { ...item, position: item.position - 1 }
                : item
            )
        );
      }
    );
  }

  const selectedDay = days.find((day) => day.id === activeDayId);
  const dayStops = (selectedDay && byDay.get(selectedDay.id)) ?? [];
  const longDate = selectedDay
    ? formatDayLabel(selectedDay.dayNumber, selectedDay.date).split(" — ")[1]
    : "";
  // The Nearby tab exists while the stop it is for is on the trip.
  const nearbyStop = stops.find((stop) => stop.id === nearbyStopId);
  const shownFinder = finder === "nearby" && !nearbyStop ? "map" : finder;
  const finderTabs: { id: FinderTab; label: string }[] = [
    { id: "search", label: "Search" },
    ...(hasSavedPlaces ? [{ id: "saved" as const, label: "Saved" }] : []),
    { id: "map", label: "Map" },
    ...(nearbyStop ? [{ id: "nearby" as const, label: "Nearby" }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          {busy || leaving ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : unsavedTimes.length > 0 ? (
            unsavedTimes.length === 1 ? (
              "1 visit time is not saved yet"
            ) : (
              `${unsavedTimes.length} visit times are not saved yet`
            )
          ) : (
            <>
              <CircleCheck aria-hidden className="h-4 w-4 text-emerald-600" />
              All changes saved
            </>
          )}
        </p>

        <Button
          onClick={() => void saveTrip()}
          onMouseDown={(event) => event.preventDefault()}
          disabled={busy || leaving}
        >
          Save trip
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? "Saving…" : status}
      </p>

      {/* The plan leads and the places to pick from support it. On a phone the panel goes under the plan. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <section aria-label="Plan" className="min-w-0 space-y-3">
          <TabStrip
            label="Days of the trip"
            idPrefix="day"
            value={activeDayId}
            onChange={setTargetDayId}
            className="flex flex-wrap gap-1.5"
            tabs={days.map((day) => {
              const count = byDay.get(day.id)?.length ?? 0;
              return {
                id: day.id,
                ariaLabel: `Day ${day.dayNumber}, ${count === 1 ? "1 place" : `${count} places`}`,
                label: (
                  <>
                    Day {day.dayNumber}
                    {count > 0 && (
                      <span
                        aria-hidden
                        className="ml-1.5 text-xs font-normal opacity-70"
                      >
                        {count}
                      </span>
                    )}
                  </>
                ),
              };
            })}
          />

          {selectedDay && (
            <div
              role="tabpanel"
              id="day-panel"
              aria-labelledby={`day-tab-${selectedDay.id}`}
              className="rounded-2xl border border-slate-200 bg-white"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="font-semibold leading-tight">{longDate}</h2>
                  <p className="text-xs text-slate-500">
                    Day {selectedDay.dayNumber} of {days.length} · {cityName}
                  </p>
                </div>
                <Button
                  id={addButtonId(selectedDay.id)}
                  variant="outline"
                  size="sm"
                  onClick={openSearch}
                  disabled={busy}
                  aria-label={`Add a place to Day ${selectedDay.dayNumber}`}
                >
                  <Plus />
                  Add a place
                </Button>
              </div>

              {dayStops.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="font-medium text-slate-800">
                    Nothing planned for {longDate} yet.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Pick a place on the map
                    {hasSavedPlaces ? ", from your saved places," : ""} or
                    search for one.
                  </p>
                </div>
              ) : (
                <ol className="px-4">
                  {dayStops.map((stop) => (
                    <StopCard
                      key={stop.id}
                      stop={stop}
                      catalogPlace={cityPlaces.find(
                        (place) => place.id === stop.placeId
                      )}
                      busy={busy}
                      moves={MOVES.map((item) => ({
                        ...item,
                        option: moveOption(days, stops, stop.id, item.move),
                      }))}
                      onMove={(body, label) =>
                        void change(
                          stop,
                          body,
                          `${stop.place.name}: ${label.toLowerCase()}.`
                        )
                      }
                      timeValue={timeDrafts[stop.id] ?? stop.visitTime ?? ""}
                      onTimeChange={(value) => typeTime(stop, value)}
                      onTimeSave={() =>
                        void saveTime(stop, timeDrafts[stop.id] ?? "")
                      }
                      onRemove={() => remove(stop)}
                      onNearby={() => openNearby(stop)}
                    />
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>

        <section
          aria-label="Find places"
          className="min-w-0 space-y-3 lg:sticky lg:top-4"
        >
          <TabStrip
            label="Where to find places"
            idPrefix="finder"
            value={shownFinder}
            onChange={(id) => setFinder(id as FinderTab)}
            className="flex gap-1.5"
            tabs={finderTabs}
          />

          <div
            role="tabpanel"
            id="finder-panel"
            aria-labelledby={`finder-tab-${shownFinder}`}
          >
            {shownFinder === "search" && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-600">
                  Adding to{" "}
                  <span className="font-medium text-slate-900">
                    {selectedDay ? `Day ${selectedDay.dayNumber}` : "the day"}
                  </span>
                  , {longDate}.
                </p>
                <div className="space-y-1">
                  <Label htmlFor={SEARCH_INPUT_ID}>Place</Label>
                  <PlaceSearchAutocomplete
                    inputId={SEARCH_INPUT_ID}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    localPlaces={cityPlaces}
                    cityName={cityName}
                    onSelectLocalPlace={addLocalPlace}
                    onSelectOsmPlace={addOsmPlace}
                    disabled={busy}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-place-time">Visit time (optional)</Label>
                  <Input
                    id="add-place-time"
                    type="time"
                    value={addTime}
                    onChange={(event) => setAddTime(event.target.value)}
                    disabled={busy}
                    className="sm:w-32"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Without a time, the place goes at the end of the day.
                </p>
              </div>
            )}

            {shownFinder === "saved" && (
              <PlannerSavedPlaces
                cityName={cityName}
                cityPlaceIds={new Set(cityPlaces.map((place) => place.id))}
                plannedIds={new Set(stops.map((stop) => stop.placeId))}
                dayLabel={dayLabel(activeDayId)}
                disabled={busy || !activeDayId}
                onAdd={addSavedPlace}
              />
            )}

            {shownFinder === "nearby" && nearbyStop && (
              // One type filter per stop: the panel of another stop starts with All types.
              <NearbySuggestions
                key={nearbyStop.id}
                originName={nearbyStop.place.name}
                origin={nearbyStop.place}
                places={cityPlaces}
                plannedIds={new Set(stops.map((stop) => stop.placeId))}
                dayLabel={dayLabel(nearbyStop.dayId)}
                disabled={busy}
                onAdd={addNearby}
              />
            )}

            {shownFinder === "map" && (
              <div className="space-y-2">
                <MapWrapper
                  places={pins}
                  center={center}
                  zoom={13}
                  addAction={
                    activeDayId
                      ? {
                          label: `Add to ${dayLabel(activeDayId)}`,
                          disabled: busy,
                          onAdd: addFromMap,
                        }
                      : undefined
                  }
                />
                <p className="text-sm text-slate-500">
                  Click a pin to add the place to {dayLabel(activeDayId)}.{" "}
                  {plannedCount === 1
                    ? "1 place is planned."
                    : `${plannedCount} places are planned.`}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

interface TabItem {
  id: string;
  label: ReactNode;
  ariaLabel?: string;
}

// Tabs as the pattern describes them: arrows, Home and End move between them, and only the chosen one is in the
// tab order. The panel they control has the id `${idPrefix}-panel`.
function TabStrip({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
  className,
}: {
  label: string;
  idPrefix: string;
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  function onKeyDown(event: KeyboardEvent, index: number) {
    const target = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (target === undefined) return;

    event.preventDefault();
    const next = tabs[(target + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className={className}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;

        return (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            aria-label={tab.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2",
              selected
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

interface StopCardProps {
  stop: EditorStop;
  busy: boolean;
  moves: {
    move: StopMove;
    label: string;
    Icon: typeof ChevronUp;
    option: ReturnType<typeof moveOption>;
  }[];
  onMove: (body: UpdateStopBody, label: string) => void;
  timeValue: string;
  onTimeChange: (value: string) => void;
  onTimeSave: () => void;
  onRemove: () => void;
  onNearby: () => void;
  // The catalog place of the stop; a place found on OpenStreetMap is not there, so it has no rating or page.
  catalogPlace?: PlaceItem;
}

function StopCard({
  stop,
  busy,
  moves,
  onMove,
  timeValue,
  onTimeChange,
  onTimeSave,
  onRemove,
  onNearby,
  catalogPlace,
}: StopCardProps) {
  const config = getCategoryConfig(stop.place.category);
  const timeId = `stop-time-${stop.id}`;

  return (
    <li className="flex gap-3 border-b border-slate-100 py-3.5 last:border-b-0">
      <div className="w-[5.25rem] shrink-0 pt-0.5">
        <label htmlFor={timeId} className="sr-only">
          Visit time of {stop.place.name}
        </label>
        <TimeField
          id={timeId}
          value={timeValue}
          changed={timeValue !== (stop.visitTime ?? "")}
          disabled={busy}
          onChange={onTimeChange}
          onSave={onTimeSave}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600"
          >
            {stop.position}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={stop.place.name}>
              {stop.place.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              <span className={config.textColor}>{config.label}</span>
              {stop.place.address && ` · ${stop.place.address}`}
            </p>
            {catalogPlace && (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                <Star
                  aria-hidden
                  className="h-3 w-3 fill-amber-500 text-amber-500"
                />
                {formatAverageRating(catalogPlace.averageRating)} ·{" "}
                {formatReviewCount(catalogPlace.reviewCount)}
                <a
                  href={`/places/${catalogPlace.id}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Details and reviews of ${stop.place.name} (opens in a new tab)`}
                  className="ml-auto inline-flex items-center gap-0.5 text-indigo-600 underline-offset-2 hover:underline"
                >
                  Details
                  <ExternalLink aria-hidden className="h-3 w-3" />
                </a>
              </p>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
          <div className="flex gap-0.5">
            {moves.map(({ move, label, Icon, option }) => {
              const unavailable = busy || !option.available;
              const reason = option.available ? null : option.reason;
              const reasonId = `move-reason-${stop.id}-${move}`;

              return (
                <Button
                  key={move}
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 px-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                  aria-label={`${label}: ${stop.place.name}`}
                  title={reason ?? label}
                  // aria-disabled, not disabled: the button keeps the focus while the change is saved and
                  // when the stop reaches the end of its day, and the reason can be read
                  aria-disabled={unavailable}
                  aria-describedby={reason ? reasonId : undefined}
                  onClick={() => {
                    if (!unavailable && option.available)
                      onMove(option.body, label);
                  }}
                >
                  <Icon />
                  {reason && (
                    <span id={reasonId} className="sr-only">
                      {reason}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              aria-label={`Nearby places for ${stop.place.name}`}
              onClick={onNearby}
            >
              <MapPin />
              Nearby
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              aria-label={`Remove ${stop.place.name}`}
              title="Remove"
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

interface TimeFieldProps {
  id: string;
  value: string;
  changed: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

function TimeField({
  id,
  value,
  changed,
  disabled,
  onChange,
  onSave,
}: TimeFieldProps) {
  return (
    <Input
      id={id}
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        if (changed) onSave();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (changed) onSave();
        }
      }}
      readOnly={disabled}
      aria-busy={disabled}
      title="Visit time"
      className="h-8 w-full px-2 text-xs"
    />
  );
}
