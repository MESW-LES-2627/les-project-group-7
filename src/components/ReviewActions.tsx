"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { isPriceLevel, type PriceLevel } from "@/domain/reviews/rating";
import { Button } from "@/components/ui/button";
import { PriceLevelField, RatingField } from "@/components/ReviewFields";
import { Textarea } from "@/components/ui/textarea";
import {
  failureMessage,
  reviewFormErrors,
  type ReviewFormErrors,
} from "@/domain/reviews/review-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const SAVE_FAILED = "Could not save the review, try again";
const DELETE_FAILED = "Could not delete the review, try again";

interface ReviewActionsProps {
  review: {
    id: string;
    rating: number;
    text: string;
    priceLevel: string | null;
  };
}

export default function ReviewActions({ review }: ReviewActionsProps) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [priceLevel, setPriceLevel] = useState<PriceLevel | null>(
    isPriceLevel(review.priceLevel) ? review.priceLevel : null
  );
  const [text, setText] = useState(review.text);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ReviewFormErrors>({});

  function openEditor() {
    setRating(review.rating);
    setPriceLevel(isPriceLevel(review.priceLevel) ? review.priceLevel : null);
    setText(review.text);
    setError(null);
    setFieldErrors({});
    setEditing(true);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    // A review written before the price level existed can keep no price level
    const missing = reviewFormErrors(
      { rating, priceLevel, text },
      { priceLevelRequired: false }
    );
    setFieldErrors(missing);
    if (Object.keys(missing).length > 0) {
      document.getElementById(`review-text-${review.id}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reviews/${encodeURIComponent(review.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            text: text.trim(),
            ...(priceLevel ? { priceLevel } : {}),
          }),
        }
      );

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setError(failureMessage(data, SAVE_FAILED));
        return;
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(failureMessage(err, SAVE_FAILED));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reviews/${encodeURIComponent(review.id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setError(failureMessage(data, DELETE_FAILED));
        return;
      }

      setConfirmingDelete(false);
      router.refresh();
    } catch (err) {
      setError(failureMessage(err, DELETE_FAILED));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* The same look as the buttons of the table of places: Edit is the main action, Delete the outline one */}
        <Button
          type="button"
          size="sm"
          onClick={openEditor}
          className="h-7 gap-1 px-2.5 text-xs"
        >
          <Pencil />
          Edit
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={() => {
            setError(null);
            setConfirmingDelete(true);
          }}
        >
          <Trash2 />
          Delete
        </Button>
      </div>

      <Dialog
        open={editing}
        onOpenChange={(open) => {
          if (!isSubmitting) setEditing(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit review</DialogTitle>
            <DialogDescription>
              Update your rating, price level, and review text.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} noValidate className="space-y-4">
            <RatingField
              value={rating}
              onChange={setRating}
              disabled={isSubmitting}
            />

            <PriceLevelField
              value={priceLevel}
              onChange={setPriceLevel}
              disabled={isSubmitting}
            />

            <div className="space-y-2">
              <label
                htmlFor={`review-text-${review.id}`}
                className="text-sm font-medium"
              >
                Review text
              </label>

              <Textarea
                id={`review-text-${review.id}`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                required
                disabled={isSubmitting}
                aria-invalid={fieldErrors.text ? true : undefined}
                aria-describedby={
                  fieldErrors.text
                    ? `review-text-${review.id}-error`
                    : undefined
                }
              />
              {fieldErrors.text && (
                <p
                  id={`review-text-${review.id}-error`}
                  className="text-xs text-red-600"
                >
                  {fieldErrors.text}
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => {
          if (!isSubmitting) setConfirmingDelete(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete review?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this review? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={handleDelete}
            >
              {isSubmitting ? "Deleting…" : "Delete review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
