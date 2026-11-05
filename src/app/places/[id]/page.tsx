import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCategoryConfig } from "@/domain/catalog/categories";
import { CategorySymbol } from "@/components/CategorySymbol";
import { formatPriceLevel, isPriceLevel } from "@/domain/reviews/rating";
import {
  formatAverageRating,
  formatReviewCount,
  newestFirst,
} from "@/domain/catalog/place-details";
import type { PlaceItem } from "@/components/PlaceExplorer";
import WriteReviewButton from "./WriteReviewButton";

export const dynamic = "force-dynamic";

interface PlacePageProps {
  params: Promise<{ id: string }>;
}

/**
 * Place page server component (US-B4-01, #29).
 * Renders catalog place details, rating summary, price level and reviews.
 */
export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;

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

  // shortcut: all reviews of a place are loaded and sorted in memory; add pagination when a place passes ~100 reviews.
  const orderedReviews = newestFirst(place.reviews);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
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

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
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

          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <span>
              {place.address}, {place.city.name}, {place.city.country}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />

              <span>{formattedRating}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 dark:text-slate-400">
                {formattedCount}
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {formattedPrice}
            </span>
          </div>

          <p className="text-base text-slate-700 dark:text-slate-300">
            {place.description ?? "No description yet."}
          </p>
        </section>

        <section
          aria-labelledby="reviews-heading"
          className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                id="reviews-heading"
                className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
              >
                Reviews
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formattedCount}
              </p>
            </div>

            <WriteReviewButton
              place={placeItem}
              currentUsername={currentUsername}
              isFirst={orderedReviews.length === 0}
            />
          </div>

          {orderedReviews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                No reviews yet
              </p>

              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Be the first to share your experience with this place.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {orderedReviews.map((rev) => {
                const author =
                  rev.user.displayUsername ?? rev.user.username ?? "Anonymous";

                const hasPrice = isPriceLevel(rev.priceLevel);
                const hasText = rev.text && rev.text.trim().length > 0;

                return (
                  <li key={rev.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
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
                          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {formatPriceLevel(rev.priceLevel)}
                          </span>
                        )}
                      </div>

                      <time
                        dateTime={rev.createdAt.toISOString()}
                        className="text-xs text-slate-400 dark:text-slate-500"
                      >
                        {rev.createdAt.toLocaleDateString("en-GB")}
                      </time>
                    </div>

                    {hasText && (
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                        {rev.text}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <footer className="pt-4 text-xs text-slate-400 dark:text-slate-600">
          Data &copy;{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-slate-600 dark:hover:text-slate-400"
          >
            OpenStreetMap
          </a>{" "}
          contributors
        </footer>
      </main>
    </div>
  );
}
