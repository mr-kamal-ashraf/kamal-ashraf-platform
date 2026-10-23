import type { ReactNode } from "react";

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="size-1.5 rounded-full bg-primary" />
      <span className="text-sm font-bold text-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
