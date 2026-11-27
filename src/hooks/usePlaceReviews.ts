"use client";

import { useCallback, useState } from "react";
import type { PlaceItem } from "@/components/PlaceExplorer";
import type { ReviewItem } from "@/components/ReviewModal";
import type { PriceLevel } from "@/domain/reviews/rating";
import { failureMessage } from "@/domain/reviews/review-form";

const POST_FAILED = "Could not post the review, try again";

interface UsePlaceReviewsOptions {
  currentUsername: string | null;
  onPlaceUpdated: (updatedPlace: PlaceItem, createdReview?: ReviewItem) => void;
}

export function usePlaceReviews({
  currentUsername,
  onPlaceUpdated,
}: UsePlaceReviewsOptions) {
  const [activeReviewPlace, setActiveReviewPlace] = useState<PlaceItem | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewsFailed, setReviewsFailed] = useState(false);

  // Both stay the same between renders (useCallback): openReviewModal reaches the
  // memoized map pins, and a new function on every render would re-render them.
  const fetchReviewsForPlace = useCallback(async (placeId: string) => {
    // The reviews of the place opened before must not show while these load (#187)
    setReviewsList([]);
    setReviewsFailed(false);
    setIsLoadingReviews(true);

    try {
      const res = await fetch(
        `/api/reviews?placeId=${encodeURIComponent(placeId)}`
      );

      if (!res.ok) throw new Error(`reviews answered ${res.status}`);

      const data: unknown = await res.json();
      setReviewsList(Array.isArray(data) ? (data as ReviewItem[]) : []);
    } catch {
      // Not "No reviews yet": the list says it could not be loaded
      setReviewsFailed(true);
    } finally {
      setIsLoadingReviews(false);
    }
  }, []);

  const openReviewModal = useCallback(
    (place: PlaceItem) => {
      setActiveReviewPlace(place);
      setSubmitSuccess(null);
      setErrorMsg(null);
      fetchReviewsForPlace(place.id);
    },
    [fetchReviewsForPlace]
  );

  const closeReviewModal = () => {
    setActiveReviewPlace(null);
    setSubmitSuccess(null);
    setErrorMsg(null);
  };

  const handleSubmitReview = async (
    rating: number,
    comment: string,
    priceLevel: PriceLevel
  ) => {
    if (!activeReviewPlace) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: activeReviewPlace.id,
          rating,
          text: comment,
          priceLevel,
          place: {
            name: activeReviewPlace.name,
            address: activeReviewPlace.address,
            category: activeReviewPlace.category,
            latitude: activeReviewPlace.latitude,
            longitude: activeReviewPlace.longitude,
            priceLevel: activeReviewPlace.priceLevel,
          },
        }),
      });

      if (!res.ok) {
        const errData: unknown = await res.json().catch(() => null);
        setErrorMsg(failureMessage(errData, POST_FAILED));
        return;
      }

      const data: unknown = await res.json();
      const updatedPlace = (data as { place: PlaceItem }).place;
      const createdReview = (data as { review: ReviewItem }).review;

      onPlaceUpdated(updatedPlace, createdReview);
      // The server just saved a visit with the review
      setActiveReviewPlace({ ...updatedPlace, isVisited: true });

      if (createdReview) {
        setReviewsList((prev) => [
          {
            ...createdReview,
            priceLevel: createdReview.priceLevel ?? priceLevel,
            user: { username: currentUsername ?? "" },
          },
          ...prev,
        ]);
      }

      setSubmitSuccess("Review submitted! Place marked as visited.");
    } catch (err: unknown) {
      setErrorMsg(failureMessage(err, POST_FAILED));
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    activeReviewPlace,
    reviewsList,
    isLoadingReviews,
    reviewsFailed,
    retryReviews: () => {
      if (activeReviewPlace) void fetchReviewsForPlace(activeReviewPlace.id);
    },
    isSubmitting,
    submitSuccess,
    errorMsg,
    openReviewModal,
    closeReviewModal,
    handleSubmitReview,
  };
}
