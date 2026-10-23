"use client";

import { useRef } from "react";

interface TopicsListFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * A todo-list style editor for a lesson's "محاور" (topics): one row per
 * topic, each with its own input and a remove (✕) button, plus an "إضافة
 * محور" row at the bottom — instead of a free-text textarea where the admin
 * had to create new lines by hand.
 *
 * Enter on a row adds a new row right after it (and focuses it); Backspace
 * on an already-empty row removes it and focuses the previous one — the
 * usual checklist/todo-list muscle memory.
 */
export function TopicsListField({ value, onChange }: TopicsListFieldProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Always show at least one row so the list never looks broken/empty.
  const rows = value.length > 0 ? value : [""];

  function focusRow(index: number) {
    requestAnimationFrame(() => inputRefs.current[index]?.focus());
  }

  function updateAt(index: number, text: string) {
    const next = rows.slice();
    next[index] = text;
    onChange(next);
  }

  function addRow(afterIndex: number) {
    const next = rows.slice();
    next.splice(afterIndex + 1, 0, "");
    onChange(next);
    focusRow(afterIndex + 1);
  }

  function removeRow(index: number) {
    if (rows.length === 1) {
      onChange([""]);
      focusRow(0);
      return;
    }
    const next = rows.slice();
    next.splice(index, 1);
    onChange(next);
    focusRow(Math.max(0, index - 1));
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRow(index);
    } else if (e.key === "Backspace" && rows[index] === "" && rows.length > 1) {
      e.preventDefault();
      removeRow(index);
    }
  }

  return (
    <div className="space-y-2">
      {rows.map((topic, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="size-1.5 flex-shrink-0 rounded-full bg-muted-foreground/40" />
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            value={topic}
            onChange={(e) => updateAt(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            placeholder={`محور ${index + 1}`}
            className="min-h-[40px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            aria-label="حذف المحور"
            title="حذف المحور"
            className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
          >
            <XIcon />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => addRow(rows.length - 1)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
      >
        <PlusIcon />
        إضافة محور
      </button>
    </div>
  );
}

function XIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
