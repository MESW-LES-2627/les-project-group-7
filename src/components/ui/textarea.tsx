import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable Shadcn UI Textarea component.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "shadow-xs w-full rounded-xl border border-slate-200 bg-transparent p-3 text-xs text-slate-800 transition-colors placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
