"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlannerSavedPlaces from "@/components/PlannerSavedPlaces";
import PlaceSearchAutocomplete from "@/components/PlaceSearchAutocomplete";
import { getCategoryConfig } from "@/domain/catalog/categories";
import {
  addStopBody,
  moveOption,
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

const addButtonId = (dayId: string) => `add-to-day-${dayId}`;

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

  const [targetDayId, setTargetDayId] = useState(days[0]?.id ?? "");
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [addTime, setAddTime] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // The day to add to has to be a day the trip has now: the dates can change under this page (the Edit trip
  // dialog), and a day that is gone must not be sent.
  const activeDayId = days.some((day) => day.id === targetDayId)
    ? targetDayId
    : (days[0]?.id ?? "");

  const byDay = stopsByDay(days, stops);
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
    add({
      id: place.id,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      category: place.category,
      priceLevel: place.priceLevel,
    });
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

  function chooseDay(dayId: string) {
    setTargetDayId(dayId);
    document.getElementById(SEARCH_INPUT_ID)?.focus();
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

  return (
    <div className="space-y-6">
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

      <section
        aria-labelledby="add-place-heading"
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <h2 id="add-place-heading" className="font-semibold">
          Add a place
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Search the places of {cityName}. Press Enter to also search
          OpenStreetMap. The place goes at the end of the day, or among the
          stops with a time if you give one.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="add-place-day">Day</Label>
            <select
              id="add-place-day"
              value={activeDayId}
              onChange={(event) => setTargetDayId(event.target.value)}
              disabled={busy}
              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm sm:w-auto"
            >
              {days.map((day) => (
                <option key={day.id} value={day.id}>
                  {formatDayLabel(day.dayNumber, day.date)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="add-place-time">Time (optional)</Label>
            <Input
              id="add-place-time"
              type="time"
              value={addTime}
              onChange={(event) => setAddTime(event.target.value)}
              disabled={busy}
              className="sm:w-32"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
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
        </div>
      </section>

      <PlannerSavedPlaces
        cityName={cityName}
        cityPlaceIds={new Set(cityPlaces.map((place) => place.id))}
        plannedIds={new Set(stops.map((stop) => stop.placeId))}
        dayLabel={dayLabel(activeDayId)}
        disabled={busy || !activeDayId}
        onAdd={addSavedPlace}
      />

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

      {/* relative: the screen-reader-only labels inside are positioned against this strip, so they are
          clipped with it and do not widen the page (the page scrolled sideways on a phone) */}
      <ol className="relative flex snap-x gap-4 overflow-x-auto pb-4">
        {days.map((day) => {
          const dayStops = byDay.get(day.id) ?? [];
          const label = formatDayLabel(day.dayNumber, day.date);

          return (
            <li
              key={day.id}
              aria-labelledby={`day-heading-${day.id}`}
              className="flex w-72 shrink-0 snap-start flex-col rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3
                  id={`day-heading-${day.id}`}
                  className="font-semibold leading-tight"
                >
                  {label}
                </h3>
                <Button
                  id={addButtonId(day.id)}
                  variant="ghost"
                  size="sm"
                  onClick={() => chooseDay(day.id)}
                  disabled={busy}
                  aria-label={`Add a place to Day ${day.dayNumber}`}
                >
                  <Plus />
                  Add
                </Button>
              </div>

              {dayStops.length === 0 ? (
                <p className="text-sm text-slate-500">No places yet</p>
              ) : (
                <ol className="space-y-2">
                  {dayStops.map((stop) => (
                    <StopCard
                      key={stop.id}
                      stop={stop}
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
                    />
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
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
}: StopCardProps) {
  const config = getCategoryConfig(stop.place.category);
  const timeId = `stop-time-${stop.id}`;

  return (
    <li className="shadow-xs rounded-lg border border-slate-200 bg-white p-2.5">
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
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Clock aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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

      <div className="mt-2 flex items-center justify-between gap-1">
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
      className="h-7 w-28 px-2 text-xs"
    />
  );
}
