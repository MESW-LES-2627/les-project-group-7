"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  PRICE_LEVELS,
  formatPriceLevel,
  isPriceLevel,
  type PriceLevel,
} from "@/domain/reviews/rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

  function openEditor() {
    setRating(review.rating);
    setPriceLevel(isPriceLevel(review.priceLevel) ? review.priceLevel : null);
    setText(review.text);
    setError(null);
    setEditing(true);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating < 1 || rating > 5 || !text.trim()) {
      setError("Please provide a valid rating and review text.");
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
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not update the review.");
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the review."
      );
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
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete the review.");
      }

      setConfirmingDelete(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete the review."
      );
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

          <form onSubmit={handleSave} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Rating</legend>

              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={rating === value ? "default" : "outline"}
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                    disabled={isSubmitting}
                  >
                    {value} ★
                  </Button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Price level</legend>

              <div className="flex flex-wrap gap-2">
                {PRICE_LEVELS.map((level) => (
                  <Button
                    key={level}
                    type="button"
                    size="sm"
                    variant={priceLevel === level ? "default" : "outline"}
                    aria-pressed={priceLevel === level}
                    onClick={() => setPriceLevel(level)}
                    disabled={isSubmitting}
                  >
                    {formatPriceLevel(level)}
                  </Button>
                ))}
              </div>
            </fieldset>

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
              />
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

              <Button type="submit" disabled={isSubmitting || !text.trim()}>
                {isSubmitting ? "Saving..." : "Save changes"}
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
              {isSubmitting ? "Deleting..." : "Delete review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
