import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, MapPin, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { CategorySymbol } from "@/components/CategorySymbol";
import { formatPriceLevel, isPriceLevel } from "@/domain/reviews/rating";
import {
  formatAverageRating,
  formatReviewCount,
  newestFirst,
  ownReviewsFirst,
} from "@/domain/catalog/place-details";
import type { PlaceItem } from "@/components/PlaceExplorer";
import WriteReviewButton from "./WriteReviewButton";
import SavedPlacesProvider from "@/components/SavedPlacesProvider";
import SavePlaceButtons from "@/components/SavePlaceButtons";
import {
  openingHoursGroups,
  openingHoursRows,
} from "@/domain/osm/opening-hours-rows";
import ReviewActions from "@/components/ReviewActions";
import { placeLocation } from "@/domain/catalog/place-location";
import PageLinks from "@/components/PageLinks";
import { pageView } from "@/domain/catalog/pages";
import FilterLinks from "@/components/FilterLinks";
import { chosenStars, starCounts } from "@/domain/reviews/review-filter";

export const dynamic = "force-dynamic";

interface PlacePageProps {
  params: Promise<{ id: string }>;
  /** `?page=2`: the page of the reviews (#187). */
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** Reviews on each page of a place (#187). */
const REVIEWS_PER_PAGE = 10;

/**
 * Place page server component (US-B4-01, #29).
 * Renders catalog place details, rating summary, price level and reviews.
 */
export default async function PlacePage({
  params,
  searchParams,
}: PlacePageProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};

  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      city: { select: { id: true, name: true, country: true } },
      reviews: {
        include: {
          user: { select: { username: true, displayUsername: true } },
        },
      },
    },
  });

  if (!place) {
    notFound();
  }

  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch((error) => {
      console.error("getSession failed:", error);
      return null;
    });

  const currentUsername = session
    ? (session.user.displayUsername ?? session.user.username ?? null)
    : null;

  // A visit is saved with each review the user posts
  const isVisited = session
    ? (await prisma.visit.findUnique({
        where: { userId_placeId: { userId: session.user.id, placeId: id } },
      })) !== null
    : false;

  const categoryConfig = getCategoryConfig(place.category);

  const formattedRating = formatAverageRating(place.averageRating);
  const formattedCount = formatReviewCount(place.reviewCount);
  const formattedPrice = formatPriceLevel(place.priceLevel);

  const placeItem: PlaceItem = {
    id: place.id,
    cityId: place.cityId,
    name: place.name,
    description: place.description,
    category: place.category,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    priceLevel: place.priceLevel,
    averageRating: place.averageRating,
    reviewCount: place.reviewCount,
    city: place.city,
    isVisited,
  };

  // shortcut: all reviews of a place are loaded and sorted in memory, then cut into pages of 10 (#187); ask the
  // database for one page when a place passes ~100 reviews.
  // The review of the logged-in user comes first, then the others, newest first
  const orderedReviews = ownReviewsFirst(
    newestFirst(place.reviews),
    (rev) => session !== null && rev.userId === session.user.id
  );
  // All reviews, or only the ones of the rating chosen in the address (#187)
  const stars = starCounts(orderedReviews);
  const chosen = chosenStars(query.stars, stars);
  const listedReviews =
    chosen === null
      ? orderedReviews
      : orderedReviews.filter((rev) => rev.rating === chosen);
  // The hours read, a season of several rows under its own heading; the rules not read, apart
  const hoursGroups = openingHoursGroups(place.openingHours);
  const listedHours = openingHoursRows(place.openingHours).filter(
    (row) => !row.when
  );
  const reviewPage = pageView(
    listedReviews.length,
    query.page,
    REVIEWS_PER_PAGE
  );
  const pageReviews = listedReviews.slice(
    reviewPage.skip,
    reviewPage.skip + reviewPage.take
  );
  // The links land on the reviews, not on the top of the page; a rating keeps its pages, and choosing
  // one goes back to page 1
  const reviewsHref = (rating: number | null, page = 1) => {
    const params = new URLSearchParams();
    if (rating !== null) params.set("stars", String(rating));
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    return `/places/${place.id}${search ? `?${search}` : ""}#reviews`;
  };
  // One review per person and place: who wrote one changes it with Edit, there is nothing to write (#187)
  const hasOwnReview =
    session !== null &&
    place.reviews.some((rev) => rev.userId === session.user.id);

  // Full width, like the header and the other pages (#187)
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <main className="space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to places
          </Link>
        </div>

        {/* The place on the left, its opening hours in a box on the right on a wide screen (#187) */}
        <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {place.name}
              </h1>

              <div className="flex items-center gap-2">
                {isVisited && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Visited
                  </span>
                )}

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${categoryConfig.bgColor} ${categoryConfig.textColor} ${categoryConfig.borderColor} border`}
                >
                  <CategorySymbol
                    type={categoryConfig.iconType}
                    className="h-3.5 w-3.5"
                  />
                  {categoryConfig.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <span>
                {placeLocation(
                  place.address,
                  place.city.name,
                  place.city.country
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 font-medium text-slate-900">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />

                <span>{formattedRating}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600">{formattedCount}</span>
              </div>

              <span className="text-slate-300">|</span>

              <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {formattedPrice}
              </span>
            </div>

            <SavedPlacesProvider loggedIn={session !== null}>
              <SavePlaceButtons
                variant="full"
                place={{
                  id: place.id,
                  name: place.name,
                  category: place.category,
                  address: place.address,
                  averageRating: place.averageRating,
                  reviewCount: place.reviewCount,
                  priceLevel: place.priceLevel,
                  city: { name: place.city.name, country: place.city.country },
                }}
              />
            </SavedPlacesProvider>

            <p className="text-base text-slate-700">
              {place.description ?? "No description yet."}
            </p>
          </div>

          <aside
            aria-labelledby="hours-heading"
            className="h-fit rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
          >
            <h2
              id="hours-heading"
              className="flex items-center gap-2 font-semibold text-slate-900"
            >
              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
              Opening hours
            </h2>

            {/* Nothing read: the hours are unknown, even when OpenStreetMap has a note */}
            {hoursGroups.length === 0 && (
              <p className="mt-2 text-slate-500">Hours unknown</p>
            )}

            {hoursGroups.map((group, groupIndex) => (
              // Each period is a block of its own: a line above it, and its name as a small label
              <div
                key={groupIndex}
                className={
                  groupIndex === 0
                    ? "hours-group mt-3"
                    : "hours-group mt-3 border-t border-slate-200 pt-3"
                }
              >
                {group.heading && (
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {group.heading}
                  </h3>
                )}
                <dl className="space-y-2">
                  {group.rows.map((row, index) => (
                    <div
                      key={index}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <dt className="text-slate-600">{row.when}</dt>
                      <dd className="text-right font-medium tabular-nums text-slate-900">
                        {/* Each opening time on its own line, never broken in the middle */}
                        {row.hours.map((time) => (
                          <span key={time} className="block whitespace-nowrap">
                            {time}
                          </span>
                        ))}
                        {row.note && (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            {row.note}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            {/* The rules not read yet, as they are, so nothing is lost */}
            {listedHours.length > 0 && (
              <div
                className={
                  hoursGroups.length > 0
                    ? "mt-3 border-t border-slate-200 pt-3"
                    : "mt-3"
                }
              >
                <p className="text-xs text-slate-500">
                  As listed on OpenStreetMap:
                </p>
                <ul className="mt-1 space-y-1 text-xs text-slate-700">
                  {listedHours.map((row, index) => (
                    <li key={index} className="break-words">
                      {row.hours[0]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>

        <section
          id="reviews"
          aria-labelledby="reviews-heading"
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                id="reviews-heading"
                className="text-xl font-bold tracking-tight text-slate-900"
              >
                Reviews
              </h2>

              <p className="text-xs text-slate-500">{formattedCount}</p>
            </div>

            {!hasOwnReview && (
              <WriteReviewButton
                place={placeItem}
                currentUsername={currentUsername}
                isFirst={orderedReviews.length === 0}
              />
            )}
          </div>

          <FilterLinks
            options={stars.map((entry) => ({
              id: String(entry.stars),
              name: `${entry.stars} ★`,
              count: entry.count,
            }))}
            selectedId={chosen === null ? null : String(chosen)}
            hrefFor={(id) => reviewsHref(id === null ? null : Number(id))}
            label="Filter by stars"
            allLabel="All reviews"
          />

          {orderedReviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No reviews yet
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Be the first to share your experience with this place.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-slate-100">
              {pageReviews.map((rev) => {
                const author =
                  rev.user.displayUsername ?? rev.user.username ?? "Anonymous";

                const hasPrice = isPriceLevel(rev.priceLevel);
                const hasText = rev.text && rev.text.trim().length > 0;
                const isOwnReview = session?.user.id === rev.userId;

                return (
                  <li key={rev.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {author}
                        </span>

                        <span
                          aria-label={`Rated ${rev.rating} out of 5`}
                          className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {rev.rating}/5
                        </span>

                        {hasPrice && (
                          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {formatPriceLevel(rev.priceLevel)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <time
                          dateTime={rev.createdAt.toISOString()}
                          className="text-xs text-slate-400"
                        >
                          {rev.createdAt.toLocaleDateString("en-GB")}
                        </time>

                        {isOwnReview && (
                          <ReviewActions
                            review={{
                              id: rev.id,
                              rating: rev.rating,
                              text: rev.text,
                              priceLevel: rev.priceLevel,
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* About 65 letters a line: a long review stays easy to read on a big screen (#187) */}
                    {hasText && (
                      <p className="mt-2 max-w-prose text-sm text-slate-700">
                        {rev.text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <PageLinks
            view={reviewPage}
            hrefFor={(page) => reviewsHref(chosen, page)}
            noun="reviews"
            label="Pages of the reviews"
          />
        </section>
      </main>
    </div>
  );
}
