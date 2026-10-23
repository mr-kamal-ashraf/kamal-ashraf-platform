"use client";

import { useState } from "react";
import { coursesApi, isApiError } from "@/api";
import { cn } from "@/shared/lib/cn";

export interface RedeemedCourse {
  id: string;
  title: string;
  slug: string;
}

/**
 * «عندك كود؟» — a student types a prepaid course code and the course opens
 * (the caller greets them with the welcome popup).
 * Collapsed to a link until opened, so it never competes with the buy button.
 * The server forgives spaces, dashes, lower case and Arabic digits.
 */
export function RedeemCodeForm({
  courseId,
  onRedeemed,
  className,
}: {
  /** On a course's page: the code must be for this course. */
  courseId?: string;
  onRedeemed: (course: RedeemedCourse) => void | Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (code.replace(/[\s-]/g, "").length < 12) {
      setError("الكود 12 حرف ورقم، زي: ABCD-EFGH-JKMN");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { course } = await coursesApi.redeemCode(code, courseId);
      setCode("");
      setOpen(false);
      await onRedeemed(course);
    } catch (err) {
      setError(isApiError(err) ? err.message : "حصل خطأ، حاول تاني.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "text-sm font-bold text-primary transition-colors hover:text-primary/80 hover:underline",
          className,
        )}
      >
        عندك كود؟ فعّله هنا
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn("w-full space-y-2", className)}
    >
      <label
        htmlFor="course-code"
        className="block text-sm font-bold text-foreground"
      >
        اكتب كود الكورس
      </label>
      <div className="flex gap-2">
        <input
          id="course-code"
          dir="ltr"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="XXXX-XXXX-XXXX"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-center font-mono text-base font-bold tracking-widest placeholder:font-sans placeholder:tracking-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary shrink-0"
        >
          {loading ? "لحظة..." : "فعّل"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          الكود اللي على الكارت — بيتفتحلك الكورس على طول.
        </p>
      )}
    </form>
  );
}
