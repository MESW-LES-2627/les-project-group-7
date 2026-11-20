"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTrip } from "@/lib/delete-trip";

interface DeleteTripDialogProps {
  tripId: string;
  tripName: string;
}

/** A button that asks for confirmation, then deletes the trip and goes back to the home page (US-E3-01). */
export default function DeleteTripDialog({
  tripId,
  tripName,
}: DeleteTripDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  function handleOpen() {
    setMessage("");
    setOpen(true);
  }

  // Escape, the backdrop, the X and "Keep trip" close it the same way, but not while the request
  // is in flight: closing then would still end on the home page.
  function handleClose() {
    if (deleting) {
      return;
    }

    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      handleOpen();
    } else {
      handleClose();
    }
  }

  async function confirm() {
    setDeleting(true);
    setMessage("");

    const result = await deleteTrip(tripId);

    if (result.ok) {
      // The button stays disabled so a double click cannot send a second request.
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(result.message);
    setDeleting(false);
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <Trash2 />
        Delete trip
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          aria-label="Delete this trip?"
          aria-busy={deleting}
          onClose={handleClose}
        >
          <DialogHeader>
            <DialogTitle>Delete this trip?</DialogTitle>

            <DialogDescription className="text-balance text-sm">
              <strong>{tripName}</strong> and everything planned in it (days and
              stops) will be deleted. This can&apos;t be undone. Places and
              reviews are not affected.
            </DialogDescription>
          </DialogHeader>

          {message && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {message}
            </p>
          )}

          <DialogFooter className="mt-5 flex-col-reverse gap-2 sm:flex-row">
            {/* The safe choice has the focus when the dialog opens. */}
            <Button
              autoFocus
              variant="outline"
              onClick={handleClose}
              disabled={deleting}
            >
              Keep trip
            </Button>

            <Button variant="destructive" onClick={confirm} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete trip"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
