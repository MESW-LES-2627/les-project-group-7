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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  PRICE_LEVELS,
  type PriceLevel,
  formatPriceLevel,
} from "@/domain/reviews/rating";

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
  const [hoverRating, setHoverRating] = useState(0);
  const [priceLevel, setPriceLevel] = useState<PriceLevel | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (place) {
      setRating(null);
      setHoverRating(0);
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
          </div>
          <DialogTitle className="mt-1 text-base">{place.name}</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {place.address}
          </DialogDescription>
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

        {/* Review Form */}
        {currentUsername ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="star-rating">
                Rating (1 to 5 stars) <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-1.5" id="star-rating">
                {[1, 2, 3, 4, 5].map((starValue) => (
                  <Button
                    type="button"
                    key={starValue}
                    variant="ghost"
                    size="icon"
                    onClick={() => setRating(starValue)}
                    onMouseEnter={() => setHoverRating(starValue)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="h-9 w-9 text-slate-300 hover:text-amber-400"
                    title={`${starValue} stars`}
                  >
                    <Star
                      className={`h-7 w-7 ${
                        starValue <= (hoverRating || rating || 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      } transition-transform active:scale-90`}
                    />
                  </Button>
                ))}
                <span className="ml-2 text-sm font-bold text-slate-700">
                  {rating ? `${rating} / 5` : "Choose a rating"}
                </span>
              </div>
            </div>

            <div>
              <Label>
                Price level <span className="text-rose-500">*</span>
              </Label>
              <div
                role="radiogroup"
                aria-label="Price level"
                className="mt-1.5 flex flex-wrap gap-2"
              >
                {PRICE_LEVELS.map((lvl) => {
                  const isSelected = priceLevel === lvl;
                  return (
                    <Button
                      key={lvl}
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className={
                        isSelected
                          ? "h-8 px-3 text-xs font-semibold"
                          : "h-8 px-3 text-xs text-slate-600 hover:text-slate-900"
                      }
                      aria-checked={isSelected}
                      role="radio"
                      onClick={() => setPriceLevel(lvl)}
                    >
                      {formatPriceLevel(lvl)}
                    </Button>
                  );
                })}
              </div>
            </div>

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
              {reviews.map((review) => (
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
