import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { CityCount } from "@/domain/catalog/city-filter";
import { cn } from "@/lib/utils";

/**
 * The city buttons of History and Saved (#187): "All cities" and each city with its number of places,
 * with the look of the city buttons of the home page; Saved leaves out "All cities". They are links, so the city stays in the address
 * (Back, refresh and a shared link keep it). Nothing shows when the places are all in one city.
 */
export default function CityFilter({
  cities,
  selectedId,
  hrefFor,
  withAll = true,
}: {
  /** The cities with places, in the order to show (see citiesWithPlaces). */
  cities: readonly CityCount[];
  selectedId: string | null;
  hrefFor: (cityId: string | null) => string;
  /** False on a page that always shows one city (Saved). */
  withAll?: boolean;
}) {
  if (cities.length < 2) return null;

  const total = cities.reduce((sum, city) => sum + city.count, 0);

  return (
    <nav aria-label="Filter by city" className="mb-6">
      <ul className="flex flex-wrap items-center gap-1.5" role="list">
        {withAll && (
          <li>
            <CityLink
              href={hrefFor(null)}
              selected={selectedId === null}
              label="All cities"
              count={total}
            />
          </li>
        )}
        {cities.map((city) => (
          <li key={city.id}>
            <CityLink
              href={hrefFor(city.id)}
              selected={selectedId === city.id}
              label={city.name}
              count={city.count}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CityLink({
  href,
  selected,
  label,
  count,
}: {
  href: string;
  selected: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      className={cn(
        buttonVariants({
          size: "sm",
          variant: selected ? "default" : "outline",
        }),
        "h-7 gap-1.5 rounded-full px-3 text-xs"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 font-mono text-[10px]",
          selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
        )}
      >
        {count}
      </span>
    </Link>
  );
}
