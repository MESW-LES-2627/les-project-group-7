"use client";

import { Button } from "@/components/ui/button";
import {
  PRICE_LEVELS,
  formatPriceLevel,
  type PriceLevel,
} from "@/domain/reviews/rating";

/**
 * The two choices of a review, as buttons: the rating (1 to 5) and the price level. The card that
 * writes a review and the dialog that edits one use these, so the two forms look and work the same.
 * The person chooses: nothing is selected until `value` is set, the form does not guess.
 */

interface FieldProps<T> {
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Shows the red mark of a required field. */
  required?: boolean;
}

function Legend({
  children,
  required,
}: {
  children: string;
  required?: boolean;
}) {
  return (
    <legend className="mb-2 text-sm font-medium">
      {children}
      {required && <span className="text-rose-500"> *</span>}
    </legend>
  );
}

export function RatingField({
  value,
  onChange,
  disabled = false,
  required = false,
}: FieldProps<number>) {
  return (
    <fieldset>
      <Legend required={required}>Rating</Legend>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <Button
            key={rating}
            type="button"
            size="sm"
            variant={value === rating ? "default" : "outline"}
            aria-pressed={value === rating}
            onClick={() => onChange(rating)}
            disabled={disabled}
          >
            {rating} ★
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

export function PriceLevelField({
  value,
  onChange,
  disabled = false,
  required = false,
}: FieldProps<PriceLevel>) {
  return (
    <fieldset>
      <Legend required={required}>Price level</Legend>

      <div className="flex flex-wrap gap-2">
        {PRICE_LEVELS.map((level) => (
          <Button
            key={level}
            type="button"
            size="sm"
            variant={value === level ? "default" : "outline"}
            aria-pressed={value === level}
            onClick={() => onChange(level)}
            disabled={disabled}
          >
            {formatPriceLevel(level)}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
