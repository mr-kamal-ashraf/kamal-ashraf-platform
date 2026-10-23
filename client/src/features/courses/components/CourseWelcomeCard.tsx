import type { ReactNode } from "react";
import { welcomeMessageParts, welcomeTitle } from "@/shared/site-settings";

/**
 * What the course welcome popup says — the teacher's texts (admin → المظهر
 * والمحتوى → بوب أب التهنئة) with the student's name and the course filled
 * in. Shared by the popup and the admin preview, so both look the same.
 */
export function CourseWelcomeCard({
  title,
  message,
  line,
  firstName,
  courseTitle,
  titleId,
  children,
}: {
  /** Templates: {الاسم} / {الكورس} are filled in. */
  title: string;
  message: string;
  /** The motivating line picked for this time (none hides the box). */
  line: string | null;
  firstName?: string;
  courseTitle: string;
  titleId?: string;
  /** The buttons. */
  children: ReactNode;
}) {
  const parts = welcomeMessageParts(message, firstName);

  return (
    <>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1.5 bg-gradient-brand"
      />
      <div className="relative mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10 text-5xl">
        <span
          aria-hidden
          className="absolute inset-0 animate-ripple rounded-full border-2 border-primary/30"
        />
        🎉
      </div>

      <h2 id={titleId} className="mt-5 text-2xl font-extrabold text-foreground">
        {welcomeTitle(title, firstName, courseTitle)}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && (
              <span className="font-bold text-foreground">{courseTitle}</span>
            )}
            {part}
          </span>
        ))}
      </p>
      {line && (
        <p className="mt-4 rounded-2xl bg-primary/6 px-4 py-3 text-sm font-semibold leading-relaxed text-foreground">
          {line}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">{children}</div>
    </>
  );
}
