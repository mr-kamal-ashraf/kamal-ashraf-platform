import { Fragment } from "react";

/**
 * Renders teacher-written text where **double asterisks** mark bold words.
 * Everything else stays plain text (React escapes it), so no HTML is ever
 * injected from the settings.
 */
export function RichText({
  text,
  strongClassName = "text-foreground",
}: {
  text: string;
  strongClassName?: string;
}) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={strongClassName}>
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
