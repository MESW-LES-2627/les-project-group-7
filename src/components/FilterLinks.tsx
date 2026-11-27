import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One button of a filter: what it shows and how many there are. */
export interface FilterOption {
  id: string;
  name: string;
  count: number;
}

/**
 * A row of filter buttons with their counts (#187): the cities of History and Saved, the stars of the
 * reviews of a place. The look is the one of the city buttons of the home page. They are links, so the
 * choice stays in the address (Back, refresh and a shared link keep it). Nothing shows when there is
 * only one option, which would not filter anything.
 */
export default function FilterLinks({
  options,
  selectedId,
  hrefFor,
  label,
  allLabel,
  withAll = true,
}: {
  /** The options with something in them, in the order to show. */
  options: readonly FilterOption[];
  selectedId: string | null;
  hrefFor: (id: string | null) => string;
  /** The name of the filter for screen readers, like "Filter by city". */
  label: string;
  /** The first button, which shows everything, like "All cities". */
  allLabel: string;
  /** False on a page that always shows one option (Saved). */
  withAll?: boolean;
}) {
  if (options.length < 2) return null;

  const total = options.reduce((sum, option) => sum + option.count, 0);

  return (
    <nav aria-label={label} className="mb-6">
      <ul className="flex flex-wrap items-center gap-1.5" role="list">
        {withAll && (
          <li>
            <OptionLink
              href={hrefFor(null)}
              selected={selectedId === null}
              label={allLabel}
              count={total}
            />
          </li>
        )}
        {options.map((option) => (
          <li key={option.id}>
            <OptionLink
              href={hrefFor(option.id)}
              selected={selectedId === option.id}
              label={option.name}
              count={option.count}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function OptionLink({
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
