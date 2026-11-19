"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { editTrip } from "@/lib/edit-trip";
import type { EditTripForm, RemovedDay } from "@/lib/edit-trip";
import { revalidateMyTrips } from "@/app/trips/actions";
import { formatDayLabel } from "@/domain/trips/trip-labels";
import { TRIP_NAME_MAX_LENGTH } from "@/domain/trips/trip-validation";
import type { TripErrors } from "@/domain/trips/trip-validation";

interface EditTripDialogProps {
  tripId: string;
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * A button that opens the form to change the name and the dates of a trip (US-E2-01). When the new
 * dates would remove days that have stops, the same dialog asks first and lists what goes (AC2).
 */
export default function EditTripDialog({
  tripId,
  name,
  startDate,
  endDate,
}: EditTripDialogProps) {
  const router = useRouter();
  const initial: EditTripForm = { name, startDate, endDate };

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [removal, setRemoval] = useState<RemovedDay[] | null>(null);
  const [errors, setErrors] = useState<TripErrors>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function handleOpen() {
    setValues(initial);
    setRemoval(null);
    setErrors({});
    setMessage("");
    setOpen(true);
  }

  // Escape, the backdrop, the X and Cancel close it the same way, but not while the request is in flight.
  function handleClose() {
    if (!sending) setOpen(false);
  }

  async function send(form: EditTripForm, confirmedStops?: number) {
    setSending(true);
    setErrors({});
    setMessage("");

    const result = await editTrip(tripId, form, confirmedStops);

    if (result.status === "saved") {
      // The router keeps the "My trips" it showed: clear that copy so the list shows the new name.
      await revalidateMyTrips().catch(() => {});
      router.refresh();
      // `sending` stays true until the dialog is closed, so a second click cannot send it again.
      setOpen(false);
      setSending(false);
      return;
    }

    setSending(false);
    setValues(form);
    if (result.status === "confirm") {
      setRemoval(result.days);
      return;
    }
    setRemoval(null);
    setErrors(result.errors);
    setMessage(Object.keys(result.errors).length ? "" : result.message);
  }

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) ?? "");

    void send(
      {
        name: field("name"),
        startDate: field("startDate"),
        endDate: field("endDate"),
      },
      undefined
    );
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <Pencil />
        Edit trip
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? handleOpen() : handleClose())}
      >
        <DialogContent
          aria-label={removal ? "Remove these days?" : "Edit trip"}
          aria-busy={sending}
          onClose={handleClose}
        >
          {removal ? (
            <>
              <DialogHeader>
                <DialogTitle>Remove these days?</DialogTitle>
                <DialogDescription className="text-balance text-sm">
                  The new dates are shorter than the trip. The days below have
                  stops, which are deleted with them. This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>

              <RemovalList days={removal} />

              {message && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {message}
                </p>
              )}

              <DialogFooter className="mt-5 flex-col-reverse gap-2 sm:flex-row">
                {/* The safe choice has the focus when the warning opens. */}
                <Button
                  autoFocus
                  variant="outline"
                  onClick={() => setRemoval(null)}
                  disabled={sending}
                >
                  Go back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    void send(
                      values,
                      removal.reduce((total, day) => total + day.stops, 0)
                    )
                  }
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Remove days and save"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Edit trip</DialogTitle>
                <DialogDescription className="text-balance text-sm">
                  Change the name or the dates. The city stays the same.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-5 space-y-4"
              >
                {message && (
                  <p role="alert" className="text-sm text-red-600">
                    {message}
                  </p>
                )}

                <Field id="name" label="Name" error={errors.name}>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={values.name}
                    maxLength={TRIP_NAME_MAX_LENGTH}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-error" : undefined}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="startDate"
                    label="Start date"
                    error={errors.startDate}
                  >
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      defaultValue={values.startDate}
                      aria-invalid={!!errors.startDate}
                      aria-describedby={
                        errors.startDate ? "startDate-error" : undefined
                      }
                    />
                  </Field>

                  <Field id="endDate" label="End date" error={errors.endDate}>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      defaultValue={values.endDate}
                      aria-invalid={!!errors.endDate}
                      aria-describedby={
                        errors.endDate ? "endDate-error" : undefined
                      }
                    />
                  </Field>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={sending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sending}>
                    {sending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The days that the new dates remove, with the number of stops each one loses. */
export function RemovalList({ days }: { days: RemovedDay[] }) {
  return (
    <ul className="mt-4 space-y-1 text-sm">
      {days.map((day) => (
        <li key={day.dayNumber}>
          <strong>{formatDayLabel(day.dayNumber, day.date)}</strong>:{" "}
          {day.stops === 1 ? "1 stop" : `${day.stops} stops`}
        </li>
      ))}
    </ul>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
