import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface FieldProps {
  label: string;
  hint?: string;
  /** Shown in red under the field, whose box turns red too. */
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label
      data-invalid={error ? "true" : undefined}
      className={cn(
        "block",
        error &&
          "[&_input]:border-destructive [&_input]:focus:ring-destructive [&_select]:border-destructive [&_textarea]:border-destructive [&_textarea]:focus:ring-destructive",
      )}
    >
      <span className="mb-1.5 block text-xs font-bold text-foreground">
        {label}
        {hint && (
          <span className="mr-2 font-normal text-muted-foreground">
            — {hint}
          </span>
        )}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-xs font-semibold text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
