"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ReviewModal from "@/components/ReviewModal";
import { usePlaceReviews } from "@/hooks/usePlaceReviews";
import type { PlaceItem } from "@/components/PlaceExplorer";

interface WriteReviewButtonProps {
  place: PlaceItem;
  currentUsername: string | null;
  isFirst: boolean;
}

/**
 * Client button opening the review modal and refreshing the page upon submission (AC4, #29).
 */
export default function WriteReviewButton({
  place,
  currentUsername,
  isFirst,
}: WriteReviewButtonProps) {
  const router = useRouter();

  const {
    activeReviewPlace,
    reviewsList,
    isLoadingReviews,
    isSubmitting,
    submitSuccess,
    errorMsg,
    openReviewModal,
    closeReviewModal,
    handleSubmitReview,
  } = usePlaceReviews({
    currentUsername,
    onPlaceUpdated: () => {
      router.refresh();
    },
  });

  return (
    <>
      <Button
        type="button"
        onClick={() => openReviewModal(place)}
        className="bg-indigo-600 text-white hover:bg-indigo-500"
      >
        {isFirst ? "Write the first review" : "Write a review"}
      </Button>

      <ReviewModal
        place={activeReviewPlace}
        currentUsername={currentUsername}
        reviews={reviewsList}
        isLoadingReviews={isLoadingReviews}
        isSubmitting={isSubmitting}
        submitSuccess={submitSuccess}
        errorMessage={errorMsg}
        onClose={closeReviewModal}
        onSubmit={handleSubmitReview}
      />
    </>
  );
}
