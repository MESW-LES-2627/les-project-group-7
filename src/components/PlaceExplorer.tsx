"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  Star,
  MapPin,
  CheckCircle2,
  User,
  MessageSquare,
  Send,
  Search,
  AlertCircle,
  Loader2,
} from "lucide-react";
import MapWrapper from "./MapWrapper";
import type { BoundingBox, MapPlace } from "./MapComponent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

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

// ── Categorias & Configurações de UI ──────────────────────────────────────────
// Dica para devs: Para adicionar novas categorias de filtro, basta acrescentar entradas a este array.
const CATEGORIES = [
  { label: "All", value: "ALL" },
  { label: "Monuments", value: "MONUMENT" },
  { label: "Restaurants", value: "RESTAURANT" },
  { label: "Parks", value: "PARK" },
  { label: "Museums", value: "MUSEUM" },
  { label: "Cafes", value: "CAFE" },
];

/** Format a PriceLevel for display */
function formatPrice(priceLevel: string | null | undefined): string {
  return priceLevel === "FREE" ? "Free" : priceLevel || "€";
}

/**
 * Interactive place catalog and rating explorer.
 *
 * Features:
 * - Dynamic POI loading from OpenStreetMap via Overpass API on map pan/zoom.
 * - Real-time filtering and text search over combined DB + OSM places.
 * - Leaflet map synchronization with clickable markers.
 * - Switchable demo accounts for review authorship.
 * - Star rating Dialog with visit marking and live score updates.
 */
export default function PlaceExplorer({
  initialPlaces,
  initialUser = AVAILABLE_USERS[0],
}: {
  initialPlaces: PlaceItem[];
  initialUser?: DummyUser;
}) {
  // ── 1. Catálogo de Locais & Integração OSM ──
  const [places, setPlaces] = useState<PlaceItem[]>(initialPlaces);
  const [osmPlaces, setOsmPlaces] = useState<PlaceItem[]>([]);
  const [isFetchingOsm, setIsFetchingOsm] = useState<boolean>(false);
  const osmDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 2. Navegação do Mapa & Sessão de Utilizador ──
  const [selectedMapCenter, setSelectedMapCenter] = useState<[number, number] | null>(null);
  const [currentUser, setCurrentUser] = useState<DummyUser>(initialUser);

  // ── 3. Filtros de Pesquisa & Categorias ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // ── 4. Estado do Modal de Avaliação & Formulário ──
  const [activeReviewPlace, setActiveReviewPlace] = useState<PlaceItem | null>(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewsList, setReviewsList] = useState<
    Array<{ id: string; rating: number; text: string; createdAt: string; user: { username: string } }>
  >([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  // Single-pass merge of DB places and OSM places, deduplicating by id
  const allPlaces = useMemo(() => {
    const seenIds = new Set<string>();
    const merged: PlaceItem[] = [];

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      seenIds.add(place.id);
      merged.push(place);
    }

    for (let i = 0; i < osmPlaces.length; i++) {
      const osmPlace = osmPlaces[i];
      if (!seenIds.has(osmPlace.id)) {
        seenIds.add(osmPlace.id);
        merged.push(osmPlace);
      }
    }

    return merged;
  }, [places, osmPlaces]);

  // Memoized place filtering by category and search query
  const filteredPlaces = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return allPlaces.filter((place) => {
      const matchesCategory =
        selectedCategory === "ALL" || place.category === selectedCategory;

      if (!normalizedQuery) {
        return matchesCategory;
      }

      return (
        matchesCategory &&
        (place.name.toLowerCase().includes(normalizedQuery) ||
          place.address.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [allPlaces, selectedCategory, searchQuery]);

  // Memoized MapPlace projection for Leaflet pins
  const mapPlaces: MapPlace[] = useMemo(() => {
    return filteredPlaces.map((place) => ({
      id: place.id,
      name: place.name,
      category: place.category,
      priceLevel: place.priceLevel || "€",
      rating: place.averageRating,
      latitude: place.latitude,
      longitude: place.longitude,
    }));
  }, [filteredPlaces]);

  /** Fetches POIs from Overpass API for the visible bounding box */
  const handleMapMove = useCallback((bounds: BoundingBox) => {
    if (osmDebounceRef.current) {
      clearTimeout(osmDebounceRef.current);
    }

    osmDebounceRef.current = setTimeout(async () => {
      setIsFetchingOsm(true);

      try {
        const params = new URLSearchParams({
          south: bounds.south.toString(),
          west: bounds.west.toString(),
          north: bounds.north.toString(),
          east: bounds.east.toString(),
        });

        const res = await fetch(`/api/osm?${params}`);
        if (!res.ok) return;

        const data: unknown = await res.json();
        if (Array.isArray(data)) {
          setOsmPlaces(data);
        }
      } catch {
        // Silently ignore — OSM data is supplementary
      } finally {
        setIsFetchingOsm(false);
      }
    }, 350);
  }, []);

  const fetchReviewsForPlace = async (placeId: string) => {
    setIsLoadingReviews(true);

    try {
      const res = await fetch(`/api/reviews?placeId=${encodeURIComponent(placeId)}`);

      if (res.ok) {
        const data: unknown = await res.json();
        setReviewsList(Array.isArray(data) ? data : []);
      }
    } catch {
      setReviewsList([]);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const openReviewModal = (place: PlaceItem) => {
    setActiveReviewPlace(place);
    setRating(5);
    setComment("");
    setSubmitSuccess(null);
    setErrorMsg(null);
    fetchReviewsForPlace(place.id);
  };

  const closeReviewModal = () => {
    setActiveReviewPlace(null);
    setSubmitSuccess(null);
    setErrorMsg(null);
  };

  /** Submits a new user review to POST /api/reviews */
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
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit review");
      }

      const data = await res.json();
      const updatedPlace = data.place;
      const createdReview = data.review;

      // Atualiza o catálogo local de locais com a nova média recalculada
      setPlaces((previousPlaces) => {
        const placeExistsLocally = previousPlaces.some(
          (place) => place.id === activeReviewPlace.id
        );

        if (placeExistsLocally) {
          return previousPlaces.map((place) => {
            if (place.id !== activeReviewPlace.id) {
              return place;
            }

            return {
              ...place,
              averageRating: updatedPlace.averageRating,
              reviewCount: updatedPlace.reviewCount,
              isVisited: true,
            };
          });
        }

        // Se era um spot descoberto no mapa e ainda não estava no catálogo da BD:
        return [
          {
            ...activeReviewPlace,
            averageRating: updatedPlace.averageRating,
            reviewCount: updatedPlace.reviewCount,
            isVisited: true,
          },
          ...previousPlaces,
        ];
      });

      // Atualiza também os marcadores OSM ativos no mapa
      setOsmPlaces((previousOsmPlaces) =>
        previousOsmPlaces.map((osmPlace) => {
          if (osmPlace.id !== activeReviewPlace.id) {
            return osmPlace;
          }

          return {
            ...osmPlace,
            averageRating: updatedPlace.averageRating,
            reviewCount: updatedPlace.reviewCount,
          };
        })
      );

      if (createdReview) {
        setReviewsList((prev) => [
          { ...createdReview, user: { username: currentUser.username } },
          ...prev,
        ]);
      }

      setSubmitSuccess("Review submitted! Place marked as visited.");
      setComment("");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 1. User Session Bar ── */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Signed in as</span>
                <span className="font-semibold text-slate-100 text-sm">@{currentUser.username}</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-slate-400 mr-1">Switch user:</span>
            {AVAILABLE_USERS.map((user) => (
              <Button
                key={user.id}
                size="sm"
                variant={currentUser.id === user.id ? "default" : "secondary"}
                onClick={() => setCurrentUser(user)}
                className="text-xs h-7"
              >
                @{user.username}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Map Explorer ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500" />
                Explore on Map
              </CardTitle>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Click any pin to review. Pan and zoom to discover new places from OpenStreetMap.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {isFetchingOsm && (
                <Badge
                  variant="secondary"
                  className="gap-1.5 text-xs text-indigo-700 bg-indigo-50 border-indigo-200 animate-pulse font-normal"
                >
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                  A carregar OSM...
                </Badge>
              )}
              <Badge variant="outline">
                {filteredPlaces.length} {filteredPlaces.length === 1 ? "spot" : "spots"} visible
              </Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search spots by name or address..."
                className="pl-9 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((category) => (
                <Button
                  key={category.value}
                  size="sm"
                  variant={selectedCategory === category.value ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category.value)}
                  className="text-xs h-7 rounded-full px-3"
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <MapWrapper
            places={mapPlaces}
            center={[41.147, -8.615]}
            zoom={14}
            selectedCenter={selectedMapCenter}
            onSelectPlace={(id) => {
              const place = allPlaces.find((item) => item.id === id);
              if (place) openReviewModal(place);
            }}
            onMapMove={handleMapMove}
          />
        </CardContent>
      </Card>

      {/* ── 3. Spots Grid ── */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Places in Porto
            </CardTitle>
            <span className="text-xs text-slate-500">
              {filteredPlaces.length} of {allPlaces.length} spots
            </span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlaces.map((place) => (
              <Card key={place.id} className="bg-slate-50/70 hover:bg-white hover:shadow-sm transition-all border-slate-100">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{place.name}</CardTitle>
                    <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                      {formatPrice(place.priceLevel)}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {place.description || place.address}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="p-4 pt-0 flex items-center justify-between">
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
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedMapCenter([place.latitude, place.longitude]);
                        window.scrollTo({ top: 180, behavior: "smooth" });
                      }}
                      className="gap-1 text-xs h-8 text-slate-700 hover:text-slate-900"
                      title="Centrar no mapa"
                    >
                      <MapPin className="w-3 h-3 text-rose-500" />
                      Mapa
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => openReviewModal(place)}
                      className="gap-1.5 text-xs h-8"
                    >
                      <Star className="w-3.5 h-3.5 fill-white" />
                      Rate
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Review Dialog ── */}
      <Dialog
        open={Boolean(activeReviewPlace)}
        onOpenChange={(open) => {
          if (!open) {
            closeReviewModal();
          }
        }}
      >
        <DialogContent onClose={closeReviewModal}>
          {activeReviewPlace && (
            <>
              <DialogHeader>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                  Rate Place
                </span>
                <DialogTitle>{activeReviewPlace.name}</DialogTitle>
                <DialogDescription>{activeReviewPlace.address}</DialogDescription>
                <div className="mt-2.5 flex items-center gap-2 text-xs">
                  <Badge variant="outline">
                    Admission: {formatPrice(activeReviewPlace.priceLevel)}
                  </Badge>
                  <Badge variant="secondary">{activeReviewPlace.category}</Badge>
                </div>
              </DialogHeader>

              {/* Active user banner */}
              <Card className="mt-4 border-slate-200/80 bg-slate-50">
                <CardContent className="p-2.5 flex items-center gap-2 text-xs text-slate-700">
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>Posting as: <strong className="text-slate-900">@{currentUser.username}</strong></span>
                </CardContent>
              </Card>

              {/* Alerts */}
              {submitSuccess && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{submitSuccess}</span>
                </div>
              )}
              {errorMsg && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Review Form */}
              <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
                <div>
                  <Label htmlFor="star-rating">Rating (1 to 5 stars)</Label>
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
                          className={`w-7 h-7 ${
                            starValue <= (hoverRating || rating)
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-300"
                          } transition-transform active:scale-90`}
                        />
                      </Button>
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-700">{rating} / 5</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="review-comment">Comment (optional)</Label>
                  <Textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Share tips, favorite highlights, or best visiting hours..."
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={closeReviewModal} className="text-xs">Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} className="gap-1.5 text-xs">
                    {isSubmitting ? "Saving..." : <><Send className="w-3.5 h-3.5" />Submit Review</>}
                  </Button>
                </DialogFooter>
              </form>

              {/* Historical Reviews */}
              <Separator className="mt-6" />
              <div className="mt-5">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  Recent Reviews ({reviewsList.length})
                </h4>
                {isLoadingReviews ? (
                  <p className="text-xs text-slate-400">Loading reviews...</p>
                ) : reviewsList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No reviews yet. Be the first!</p>
                ) : (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {reviewsList.map((review) => (
                      <Card key={review.id} className="bg-slate-50 border-slate-100">
                        <CardContent className="p-2.5 text-xs">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-semibold text-slate-800">
                              @{review.user?.username || "anonymous"}
                            </span>
                            <span className="font-bold text-amber-600">★ {review.rating}</span>
                          </div>
                          {review.text && <p className="text-slate-600 mt-1">{review.text}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
