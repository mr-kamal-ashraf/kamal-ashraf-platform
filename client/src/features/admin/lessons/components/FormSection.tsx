import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  optional?: boolean;
  children: ReactNode;
}

export function FormSection({ title, optional, children }: FormSectionProps) {
  return (
    <section className="space-y-4 border-b border-border/60 pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-extrabold text-foreground">{title}</h2>
        {optional && (
          <span className="text-[11px] font-bold text-muted-foreground">
            (اختياري)
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
