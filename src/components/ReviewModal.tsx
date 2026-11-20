"use client";

/**
 * The dialog to rate a place: its details, "Posting as @username" (or a link to log in when
 * nobody is logged in), the rating and comment form, and the reviews already written. The data and
 * the sending are handled by the usePlaceReviews hook.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Star,
  User,
  CheckCircle2,
  AlertCircle,
  Send,
  MessageSquare,
  Landmark,
  Utensils,
  Building2,
  Trees,
  Coffee,
  Wine,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceLevelField, RatingField } from "@/components/ReviewFields";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PlaceItem } from "./PlaceExplorer";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { ownReviewsFirst } from "@/domain/catalog/place-details";
import {
  ALREADY_REVIEWED_MESSAGE,
  hasReviewedPlace,
} from "@/domain/reviews/one-review-rule";
import { type PriceLevel, formatPriceLevel } from "@/domain/reviews/rating";

export interface ReviewItem {
  id: string;
  rating: number;
  priceLevel?: string | null;
  text: string;
  createdAt: string;
  user: {
    username: string;
  };
}

interface ReviewModalProps {
  place: PlaceItem | null;
  currentUsername: string | null;
  /**
   * Show the button that opens the page of the place. It is hidden on that page itself, where the
   * button would lead to the page the person is already on.
   */
  showPlaceLink?: boolean;
  reviews: ReviewItem[];
  isLoadingReviews: boolean;
  isSubmitting: boolean;
  submitSuccess: string | null;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (rating: number, comment: string, priceLevel: PriceLevel) => void;
}

export default function ReviewModal({
  place,
  currentUsername,
  showPlaceLink = true,
  reviews,
  isLoadingReviews,
  isSubmitting,
  submitSuccess,
  errorMessage,
  onClose,
  onSubmit,
}: ReviewModalProps) {
  // No defaults: the reviewer chooses the rating and the price level, the form does not guess them
  const [rating, setRating] = useState<number | null>(null);
  const [priceLevel, setPriceLevel] = useState<PriceLevel | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (place) {
      setRating(null);
      setPriceLevel(null);
      setComment("");
    }
  }, [place]);

  if (!place) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!rating || !trimmed || !priceLevel) {
      return;
    }
    onSubmit(rating, trimmed, priceLevel);
  };

  const categoryConfig = getCategoryConfig(place.category);

  // The review of the logged-in user comes first (the usernames are compared without case, as for the
  // "already reviewed" notice)
  const isOwnReview = (review: ReviewItem) =>
    Boolean(currentUsername) &&
    review.user?.username?.toLowerCase() === currentUsername?.toLowerCase();

  return (
    <Dialog open={Boolean(place)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${categoryConfig.bgColor} ${categoryConfig.textColor}`}
            >
              {categoryConfig.label}
            </span>
            <Badge variant="outline" className="text-[11px]">
              {formatPriceLevel(place.priceLevel)}
            </Badge>
            {place.isVisited && (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
              >
                Visited
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-base">{place.name}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-500">
                {place.address}
              </DialogDescription>
            </div>

            {/* A place that was only found on the map is not in the catalog yet, so it has no page */}
            {showPlaceLink && !place.isDiscovered && (
              <Button
                asChild
                size="sm"
                className="shrink-0 gap-1 self-end px-2.5 text-xs sm:self-auto"
              >
                <Link href={`/places/${place.id}`}>
                  <ExternalLink className="h-3 w-3" />
                  Open place page
                </Link>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Active user session */}
        {currentUsername && (
          <Card className="mt-4 border-slate-200/80 bg-slate-50">
            <CardContent className="flex items-center gap-2 p-2.5 text-xs text-slate-700">
              <User className="h-4 w-4 text-indigo-600" />
              <span>
                Posting as:{" "}
                <strong className="text-slate-900">@{currentUsername}</strong>
              </span>
            </CardContent>
          </Card>
        )}

        {/* Feedback Alerts */}
        {submitSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{submitSuccess}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Review Form: one review per user and place, so a user who reviewed it sees a notice */}
        {currentUsername && hasReviewedPlace(reviews, currentUsername) ? (
          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {ALREADY_REVIEWED_MESSAGE}
          </p>
        ) : currentUsername ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <RatingField value={rating} onChange={setRating} required />

            <PriceLevelField
              value={priceLevel}
              onChange={setPriceLevel}
              required
            />

            <div>
              <Label htmlFor="review-comment">
                Review text <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Share tips, favorite highlights, or best visiting hours..."
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || !rating || !comment.trim() || !priceLevel
                }
                className="gap-1.5 text-xs"
              >
                {isSubmitting ? (
                  "Saving..."
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Submit Review
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <p className="mt-5 text-xs text-slate-600">
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:underline"
            >
              Log in to review
            </Link>
          </p>
        )}

        {/* Historical Reviews */}
        <Separator className="mt-6" />
        <div className="mt-5">
          <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
            Recent Reviews ({reviews.length})
          </h4>

          {isLoadingReviews ? (
            <p className="text-xs text-slate-400">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <p className="text-xs italic text-slate-400">
              No reviews yet. Be the first!
            </p>
          ) : (
            <div className="max-h-48 space-y-2.5 overflow-y-auto pr-1">
              {ownReviewsFirst(reviews, isOwnReview).map((review) => (
                <Card key={review.id} className="border-slate-100 bg-slate-50">
                  <CardContent className="p-2.5 text-xs">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-800">
                        @{review.user?.username || "anonymous"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {review.priceLevel && (
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-normal text-slate-600"
                          >
                            {formatPriceLevel(review.priceLevel)}
                          </Badge>
                        )}
                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          {review.rating}
                        </span>
                      </div>
                    </div>
                    {review.text && (
                      <p className="mt-1 text-slate-600">{review.text}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
