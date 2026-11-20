"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTrip } from "@/lib/create-trip";
import { revalidateMyTrips } from "@/app/trips/actions";
import type { TripErrors } from "@/domain/trips/trip-validation";

interface TripFormProps {
  cities: { id: string; name: string; country: string }[];
  initialErrors?: TripErrors;
  /** When the form is inside a dialog, a Cancel button closes it. */
  onCancel?: () => void;
  /** True while the request is in flight, so a dialog can refuse to close in the meantime. */
  onSendingChange?: (sending: boolean) => void;
}

/** Form of a new trip: a name, a city and the dates. The server checks everything (AC3 to AC5, AC7). */
export default function TripForm({
  cities,
  initialErrors = {},
  onCancel,
  onSendingChange,
}: TripFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<TripErrors>(initialErrors);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) ?? "");

    setSubmitting(true);
    onSendingChange?.(true);
    setErrors({});
    setMessage("");
    const result = await createTrip({
      name: field("name"),
      cityId: field("cityId"),
      startDate: field("startDate"),
      endDate: field("endDate"),
    });

    onSendingChange?.(false);

    if (result.ok) {
      // The button stays disabled so a double click cannot create the trip twice. If the
      // navigation fails, the dialog is free to close, and reopening it gives a fresh form.
      // The router keeps the "My trips" it showed and gives it back on Back: clear that copy, so
      // that the list shows the trip that was just created. A failure here must not stop the person.
      await revalidateMyTrips().catch(() => {});
      router.push(`/trips/${result.id}`);
      return;
    }
    setErrors(result.errors);
    setMessage(Object.keys(result.errors).length ? "" : result.message);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Weekend in Porto"
          maxLength={100}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        <FieldError id="name-error" text={errors.name} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="cityId">City</Label>
        <select
          id="cityId"
          name="cityId"
          defaultValue=""
          aria-invalid={!!errors.cityId}
          aria-describedby={errors.cityId ? "cityId-error" : undefined}
          className="shadow-xs flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
        >
          <option value="">Choose a city</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}, {city.country}
            </option>
          ))}
        </select>
        <FieldError id="cityId-error" text={errors.cityId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            onChange={fillEndDate}
            aria-invalid={!!errors.startDate}
            aria-describedby={errors.startDate ? "startDate-error" : undefined}
          />
          <FieldError id="startDate-error" text={errors.startDate} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            aria-invalid={!!errors.endDate}
            aria-describedby={errors.endDate ? "endDate-error" : undefined}
          />
          <FieldError id="endDate-error" text={errors.endDate} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating trip…" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}

// A new start date fills an empty end date, or one before it: a one-day trip needs a single pick.
function fillEndDate(event: React.ChangeEvent<HTMLInputElement>) {
  const start = event.currentTarget;
  const end = start.form?.elements.namedItem("endDate");
  if (
    end instanceof HTMLInputElement &&
    (!end.value || end.value < start.value)
  ) {
    end.value = start.value;
  }
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} role="alert" className="text-sm text-red-600">
      {text}
    </p>
  ) : null;
}
