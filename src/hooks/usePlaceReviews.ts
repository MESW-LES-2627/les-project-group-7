"use client";

import { useState } from "react";
import type { PlaceItem } from "@/components/PlaceExplorer";
import type { ReviewItem } from "@/components/ReviewModal";
import type { SessionUser } from "@/components/UserSessionBar";

interface UsePlaceReviewsOptions {
  currentUser: SessionUser;
  onPlaceUpdated: (updatedPlace: PlaceItem, createdReview?: ReviewItem) => void;
}

export function usePlaceReviews({
  currentUser,
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

  const fetchReviewsForPlace = async (placeId: string) => {
    setIsLoadingReviews(true);

    try {
      const res = await fetch(
        `/api/reviews?placeId=${encodeURIComponent(placeId)}`
      );

      if (res.ok) {
        const data: unknown = await res.json();
        setReviewsList(Array.isArray(data) ? (data as ReviewItem[]) : []);
      }
    } catch {
      setReviewsList([]);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const openReviewModal = (place: PlaceItem) => {
    setActiveReviewPlace(place);
    setSubmitSuccess(null);
    setErrorMsg(null);
    fetchReviewsForPlace(place.id);
  };

  const closeReviewModal = () => {
    setActiveReviewPlace(null);
    setSubmitSuccess(null);
    setErrorMsg(null);
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
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
          userId: currentUser.id,
          place: {
            name: activeReviewPlace.name,
            address: activeReviewPlace.address,
            category: activeReviewPlace.category,
            latitude: activeReviewPlace.latitude,
            longitude: activeReviewPlace.longitude,
            priceLevel: activeReviewPlace.priceLevel,
            wikidataId: activeReviewPlace.wikidataId,
          },
        }),
      });

      if (!res.ok) {
        const errData: unknown = await res.json();
        const msg =
          typeof errData === "object" && errData !== null && "error" in errData
            ? String((errData as { error: unknown }).error)
            : "Failed to submit review";
        throw new Error(msg);
      }

      const data: unknown = await res.json();
      const updatedPlace = (data as { place: PlaceItem }).place;
      const createdReview = (data as { review: ReviewItem }).review;

      onPlaceUpdated(updatedPlace, createdReview);

      if (createdReview) {
        setReviewsList((prev) => [
          { ...createdReview, user: { username: currentUser.username } },
          ...prev,
        ]);
      }

      setSubmitSuccess("Review submitted! Place marked as visited.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    activeReviewPlace,
    reviewsList,
    isLoadingReviews,
    isSubmitting,
    submitSuccess,
    errorMsg,
    openReviewModal,
    closeReviewModal,
    handleSubmitReview,
  };
}
