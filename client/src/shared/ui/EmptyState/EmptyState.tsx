import type { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  hint?: ReactNode;
  className?: string;
}

export function EmptyState({ message, hint, className }: EmptyStateProps) {
  return (
    <div
      className={
        className ??
        "rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground"
      }
    >
      <p>{message}</p>
      {hint && <div className="mt-2 text-xs opacity-75">{hint}</div>}
    </div>
  );
}
