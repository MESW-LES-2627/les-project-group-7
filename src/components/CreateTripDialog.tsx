"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TripForm from "@/components/TripForm";

interface CreateTripDialogProps {
  cities: { id: string; name: string; country: string }[];
  loggedIn: boolean;
}

/** The one way to plan a trip: a button that opens the create-trip form in a dialog. */
export default function CreateTripDialog({
  cities,
  loggedIn,
}: CreateTripDialogProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Escape, the backdrop, the X and Cancel all close the dialog the same way, but not while
  // the trip is being sent: closing then would still end on the trip page.
  const close = () => {
    if (!sending) setOpen(false);
  };

  if (!loggedIn) {
    return (
      <Button asChild size="lg">
        <Link href="/login">
          <Plus />
          Log in to plan a trip
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus />
        Plan a trip
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent aria-label="Plan a trip" onClose={close}>
          <DialogHeader>
            <DialogTitle>Plan a trip</DialogTitle>
            <DialogDescription className="text-balance text-sm">
              Choose a city and your dates, then add places on the next screen.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5">
            {cities.length === 0 ? (
              <p className="text-sm text-slate-600">
                No cities yet, so you cannot plan a trip. Please try again
                later.
              </p>
            ) : (
              <TripForm
                cities={cities}
                onCancel={close}
                onSendingChange={setSending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
