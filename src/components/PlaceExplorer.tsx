"use client";

import { useState } from "react";
import { Star, MapPin, CheckCircle2, User, X, MessageSquare, Send, Search, Database } from "lucide-react";
import MapWrapper from "./MapWrapper";

/** Spot item interface matching database places */
export interface PlaceItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  priceLevel: string | null;
  averageRating: number | null;
  reviewCount: number;
  city?: { name: string; country: string };
  isVisited?: boolean;
}

/** Demo user profile for switchable local sessions */
export interface DummyUser {
  id: string;
  username: string;
  email: string;
}

const AVAILABLE_USERS: DummyUser[] = [
  { id: "demo-user-1", username: "viajante_porto", email: "demo@tripbook.pt" },
  { id: "demo-user-2", username: "ana_exploradora", email: "ana@tripbook.pt" },
];

const CATEGORIES = [
  { label: "All", value: "ALL" },
  { label: "Monuments", value: "MONUMENT" },
  { label: "Restaurants", value: "RESTAURANT" },
  { label: "Parks", value: "PARK" },
  { label: "Museums", value: "MUSEUM" },
  { label: "Cafes", value: "CAFE" },
];

/**
 * Interactive place catalog and rating explorer.
 * 
 * Features:
 * - Real-time filtering and text search over cached OpenStreetMap POIs.
 * - Leaflet map synchronization with clickable markers.
 * - Switchable dummy accounts for review authorship.
 * - Star rating modal with visit marking and live score updates.
 */
export default function PlaceExplorer({
  initialPlaces,
  initialUser = AVAILABLE_USERS[0],
}: {
  initialPlaces: PlaceItem[];
  initialUser?: DummyUser;
}) {
  // Main state holding the list of places (reactively updated on review submission)
  const [places, setPlaces] = useState<PlaceItem[]>(initialPlaces);

  // Active dummy user used to sign submitted reviews
  const [currentUser, setCurrentUser] = useState<DummyUser>(initialUser);

  // Search query filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected category filter
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Spot currently open in review modal (null = closed)
  const [activeReviewPlace, setActiveReviewPlace] = useState<PlaceItem | null>(null);

  // Review form fields
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review history for the spot currently open in modal
  const [reviewsList, setReviewsList] = useState<
    Array<{
      id: string;
      rating: number;
      text: string;
      createdAt: string;
      user: { username: string };
    }>
  >([]);

  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(false);

  // Filter places according to category and search query
  const filteredPlaces = places.filter((p) => {
    const matchesCategory =
      selectedCategory === "ALL" || p.category === selectedCategory;

    const matchesSearch =
      searchQuery.trim() === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  // Format places into MapPlace markers expected by the map component
  const mapPlaces = filteredPlaces.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    priceLevel: p.priceLevel || "€",
    rating: p.averageRating ?? 0,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  /** Opens the review modal for a spot and loads its past review history */
  const openReviewModal = async (place: PlaceItem) => {
    setActiveReviewPlace(place);
    setRating(5);
    setHoverRating(0);
    setComment("");
    setSubmitSuccess(null);
    setErrorMsg(null);

    setIsLoadingReviews(true);

    try {
      const res = await fetch(`/api/reviews?placeId=${encodeURIComponent(place.id)}`);

      if (res.ok) {
        const data = await res.json();
        setReviewsList(data);
      }
    } catch {
      // Non-fatal preview fetch error
    } finally {
      setIsLoadingReviews(false);
    }
  };

  /** Closes the review modal and resets transient notifications */
  const closeReviewModal = () => {
    setActiveReviewPlace(null);
    setSubmitSuccess(null);
    setErrorMsg(null);
  };

  /** Submits a new review to POST /api/reviews */
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

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
          text: comment.trim(),
          userId: currentUser.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit review");
      }

      const data = await res.json();
      const updatedPlace = data.place;
      const createdReview = data.review;

      // Update places state locally with newly recalculated rating
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === activeReviewPlace.id
            ? {
                ...p,
                averageRating: updatedPlace.averageRating,
                reviewCount: updatedPlace.reviewCount,
                isVisited: true,
              }
            : p
        )
      );

      // Prepend the new review into the modal's preview list
      if (createdReview) {
        setReviewsList((prev) => [
          {
            ...createdReview,
            user: { username: currentUser.username },
          },
          ...prev,
        ]);
      }

      setSubmitSuccess("Review successfully submitted! Spot marked as visited.");
      setComment("");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Active Dummy User Session Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600/80 flex items-center justify-center font-bold text-white ring-2 ring-indigo-400/40">
            {currentUser.username[0].toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">
                Active Dummy User
              </span>

              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Demo Session
              </span>
            </div>

            <p className="font-semibold text-slate-100 flex items-center gap-2">
              @{currentUser.username}
              <span className="text-xs text-slate-400 font-mono font-normal">({currentUser.email})</span>
            </p>
          </div>
        </div>

        {/* Buttons to switch between available demo accounts */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-400">Switch:</span>

          {AVAILABLE_USERS.map((u) => (
            <button
              key={u.id}
              onClick={() => setCurrentUser(u)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                currentUser.id === u.id
                  ? "bg-indigo-600 text-white shadow-sm ring-1 ring-white/20"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              @{u.username}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Interactive Map Explorer (Leaflet + OpenStreetMap) */}
      <section className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500" />
                Porto Points of Interest (OpenStreetMap)
              </h2>

              <p className="text-xs sm:text-sm text-slate-500">
                {places.length} POIs imported and cached in PostgreSQL. Click pins or list cards to rate.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>OSM Local Cache</span>
            </div>
          </div>

          {/* Search bar and category filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search spots by name or address (e.g. Clérigos, Ribeira, Serralves)..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden transition-all text-slate-800"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium cursor-pointer ${
                    selectedCategory === cat.value
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Leaflet Map Component (SSR safe) */}
        <MapWrapper
          places={mapPlaces}
          center={[41.147, -8.615]}
          zoom={14}
          onSelectPlace={(id) => {
            const place = places.find((p) => p.id === id);
            if (place) openReviewModal(place);
          }}
        />
      </section>

      {/* 3. Spots Grid & Rate Triggers */}
      <section className="bg-white rounded-2xl p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Points of Interest Catalog
          </h2>

          <span className="text-xs text-slate-500">
            Showing {filteredPlaces.length} of {places.length} spots
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlaces.map((place) => (
            <div
              key={place.id}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:shadow-sm transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">{place.name}</h3>

                  <span className="text-xs font-mono bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded shrink-0">
                    {place.priceLevel === "FREE" ? "Free" : place.priceLevel || "€"}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {place.description || place.address}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-amber-600">
                      ★ {place.averageRating ? place.averageRating.toFixed(1) : "—"}
                    </span>

                    <span className="text-slate-400">
                      ({place.reviewCount} {place.reviewCount === 1 ? "review" : "reviews"})
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 block mt-0.5">{place.category}</span>
                </div>

                {/* Open review modal trigger */}
                <button
                  onClick={() => openReviewModal(place)}
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5 fill-white" />
                  Rate
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Review Modal with Star Rating and OSM Price Info */}
      {activeReviewPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            {/* Modal close button */}
            <button
              onClick={closeReviewModal}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Spot header */}
            <div className="pr-8">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Rate Spot
              </span>

              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {activeReviewPlace.name}
              </h3>

              <p className="text-xs text-slate-500 mt-1">{activeReviewPlace.address}</p>

              {/* Informative OSM properties */}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <span className="bg-slate-100 font-mono px-2 py-0.5 rounded text-slate-700">
                  Admission: {activeReviewPlace.priceLevel === "FREE" ? "Free" : activeReviewPlace.priceLevel || "€"} (OSM)
                </span>
                <span>•</span>
                <span className="text-slate-500">{activeReviewPlace.category}</span>
              </div>
            </div>

            {/* Active user badge */}
            <div className="mt-4 p-2.5 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-between text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span>
                  Rating as: <strong className="text-slate-900">@{currentUser.username}</strong>
                </span>
              </div>

              <span className="text-slate-400 text-[11px]">{currentUser.id}</span>
            </div>

            {/* Success toast */}
            {submitSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {/* Error banner */}
            {errorMsg && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {errorMsg}
              </div>
            )}

            {/* Review Form */}
            <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
              {/* Star Rating Input (1 to 5) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Overall Rating (1 to 5 stars)
                </label>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled = starValue <= (hoverRating || rating);

                    return (
                      <button
                        type="button"
                        key={starValue}
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-slate-300 hover:text-amber-400 focus:outline-hidden transition-colors cursor-pointer"
                        title={`${starValue} stars`}
                      >
                        <Star
                          className={`w-7 h-7 ${
                            isFilled ? "text-amber-400 fill-amber-400" : "text-slate-300"
                          } transition-transform active:scale-90`}
                        />
                      </button>
                    );
                  })}

                  <span className="ml-2 text-sm font-bold text-slate-700">{rating} / 5</span>
                </div>
              </div>

              {/* Comment Text Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Review Comment / Tips (optional)
                </label>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience, recommendations, or best visiting hours..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden transition-all text-slate-800"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="text-xs px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    "Saving..."
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit Review
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Historical Reviews List */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                Review History ({reviewsList.length})
              </h4>

              {isLoadingReviews ? (
                <p className="text-xs text-slate-400">Loading reviews...</p>
              ) : reviewsList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No reviews yet for this spot. Be the first!</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {reviewsList.map((rev) => (
                    <div key={rev.id} className="p-2.5 rounded-lg bg-slate-50 text-xs border border-slate-100">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-800">@{rev.user?.username || "anonymous"}</span>

                        <span className="font-bold text-amber-600">★ {rev.rating}</span>
                      </div>

                      {rev.text && <p className="text-slate-600 mt-1">{rev.text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
