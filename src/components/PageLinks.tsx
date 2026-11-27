import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { PageView } from "@/domain/catalog/pages";
import { cn } from "@/lib/utils";

/**
 * Previous · Page 2 of 3 · Next for a list whose page is in the address: History and the reviews of a
 * place (#187), with the look of the controls of the home ranking. Nothing shows for a single page.
 */
export default function PageLinks({
  view,
  hrefFor,
  noun,
  label,
}: {
  view: PageView;
  hrefFor: (page: number) => string;
  /** What the list counts, like "places" or "reviews". */
  noun: string;
  /** The name of the controls for screen readers. */
  label: string;
}) {
  if (view.totalPages <= 1) return null;

  return (
    <nav
      aria-label={label}
      className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row"
    >
      <span className="text-xs text-slate-500">
        Showing {view.firstShown} to {view.lastShown} of {view.total} {noun}
      </span>

      <div className="flex items-center gap-2">
        <PageLink href={hrefFor(view.page - 1)} disabled={view.page <= 1}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </PageLink>

        <span
          aria-current="page"
          className="px-2 text-xs font-medium text-slate-700"
        >
          Page {view.page} of {view.totalPages}
        </span>

        <PageLink
          href={hrefFor(view.page + 1)}
          disabled={view.page >= view.totalPages}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </PageLink>
      </div>
    </nav>
  );
}

/** Previous or Next: a link, or the same look greyed out on the first or the last page. */
function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    buttonVariants({ size: "sm", variant: "outline" }),
    "h-8 gap-1 text-xs"
  );

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(className, "pointer-events-none opacity-50")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
