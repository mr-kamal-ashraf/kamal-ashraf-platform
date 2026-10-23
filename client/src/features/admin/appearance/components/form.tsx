"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import type { FieldErrors } from "../validation";

export const INPUT =
  "min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

/**
 * A titled card that holds one editable section, with a save / reset bar.
 * With `errors`, saving is held back: the teacher gets a toast naming the
 * first problem and the page scrolls to the first box marked in red.
 */
export function SectionCard({
  title,
  description,
  children,
  dirty,
  busy,
  errors,
  onSave,
  onReset,
  saveLabel = "حفظ التعديلات",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  dirty?: boolean;
  busy?: boolean;
  errors?: FieldErrors;
  onSave?: () => unknown;
  onReset?: () => unknown;
  saveLabel?: string;
}) {
  const confirm = useConfirm();
  const ref = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  const problems = errors ? Object.values(errors) : [];

  const save = async () => {
    if (!onSave) return;
    if (problems.length > 0) {
      toast.error("لسه فيه خانات محتاجة تتظبط قبل الحفظ", {
        description: problems.length > 1 ? `${problems[0]} (و${problems.length - 1} كمان)` : problems[0],
      });
      const first = ref.current?.querySelector<HTMLElement>('[data-invalid="true"]');
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
      return;
    }
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section ref={ref} className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="text-base font-extrabold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6">{children}</div>
      {(onSave || onReset) && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3.5 sm:px-6">
          <span
            className={cn(
              "text-xs font-bold",
              problems.length > 0 ? "text-destructive" : dirty ? "text-amber-600" : "text-muted-foreground",
            )}
          >
            {problems.length > 0
              ? `● فيه ${problems.length === 1 ? "خانة محتاجة" : `${problems.length} خانات محتاجة`} تتظبط (معلّمة بالأحمر)`
              : dirty
                ? "● فيه تعديلات لسه ما اتحفظتش"
                : "كل التعديلات محفوظة"}
          </span>
          <div className="flex items-center gap-2">
            {onReset && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await confirm({
                    title: "رجوع للإعدادات الافتراضية",
                    message: "القسم ده هيرجع للمحتوى الأصلي اللي كانت المنصة بيه. متأكد؟",
                    confirmLabel: "أيوه، رجّعه",
                  });
                  if (ok) onReset();
                }}
                className="min-h-10 rounded-xl border border-border bg-background px-4 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                رجّع الافتراضي
              </button>
            )}
            {onSave && (
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={save}
                className="min-h-10 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                {saving ? "جارٍ الحفظ..." : saveLabel}
              </button>
            )}
          </div>
        </footer>
      )}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  /** Shown in red under the box, which also gets a red border. */
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      data-invalid={error ? "true" : undefined}
      className={cn(
        "block",
        error &&
          "[&_input]:border-destructive [&_input]:focus:ring-destructive [&_textarea]:border-destructive [&_textarea]:focus:ring-destructive",
        className,
      )}
    >
      <span className="mb-1.5 block text-xs font-bold text-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] font-bold text-destructive">{error}</span>}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  maxLength,
  placeholder,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      dir={dir}
      className={INPUT}
    />
  );
}

export function TextArea({
  value,
  onChange,
  maxLength,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={cn(INPUT, "resize-y leading-relaxed")}
      />
      {maxLength && (
        <div className="mt-1 text-start text-[10px] tabular-nums text-muted-foreground" dir="ltr">
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
}

/** On/off switch matching the rest of the admin panel. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-foreground">{label}</div>
        {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        dir="ltr"
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

/** Small "how it looks" frame used next to the editors. */
export function PreviewFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dashed border-primary/30 bg-background p-4", className)}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">معاينة</div>
      {children}
    </div>
  );
}

/** Small square icon button (move up / down, delete) used in list editors. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={
        "flex size-8 items-center justify-center rounded-lg border border-border bg-card transition-colors disabled:opacity-35 " +
        (danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground")
      }
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
