import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable Label component following shadcn/ui conventions.
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "mb-1.5 block text-xs font-semibold text-slate-700",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
