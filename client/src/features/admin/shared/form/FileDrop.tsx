"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";

interface FileDropProps {
  /** Same syntax as <input accept>: ".mp4,video/*". */
  accept: string;
  /** Bigger files are refused at once — not after minutes of uploading. */
  maxBytes: number;
  onFile: (file: File) => void;
  icon: "video" | "image";
  title: string;
  hint?: string;
  wrongTypeMessage: string;
  tooBigMessage: string;
  /** The chosen file (a preview, its name…). The whole box still picks another. */
  chosen?: ReactNode;
  /** Shows a remove button on a chosen file. */
  onClear?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

/** Whether a file fits an <input accept> list (type families and extensions). */
function matchesAccept(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  return accept.split(",").some((raw) => {
    const token = raw.trim().toLowerCase();
    if (!token) return false;
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return file.type.startsWith(token.slice(0, -1));
    return file.type === token;
  });
}

/**
 * A file picker you can also drop a file on: a big, plain target with what to
 * pick and its limits, instead of the browser's tiny "Choose File" button.
 */
export function FileDrop({
  accept,
  maxBytes,
  onFile,
  icon,
  title,
  hint,
  wrongTypeMessage,
  tooBigMessage,
  chosen,
  onClear,
  invalid,
  disabled,
  compact,
}: FileDropProps) {
  const [over, setOver] = useState(false);

  function take(file: File | undefined) {
    if (!file) return;
    if (!matchesAccept(file, accept)) return void toast.error(wrongTypeMessage);
    if (file.size > maxBytes) return void toast.error(tooBigMessage);
    onFile(file);
  }

  return (
    <label
      data-invalid={invalid ? "true" : undefined}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) take(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-background text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
        compact ? "px-4 py-5" : "px-4 py-8 sm:py-10",
        chosen ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-primary/5",
        over && "border-primary bg-primary/10",
        invalid && "border-destructive bg-destructive/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files?.[0]);
          // The same file can be picked again after a remove.
          e.target.value = "";
        }}
        className="sr-only"
      />
      {chosen ?? (
        <>
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          >
            {icon === "video" ? <VideoIcon /> : <ImageIcon />}
          </span>
          <span className="text-sm font-extrabold text-foreground">{title}</span>
          {hint && <span className="max-w-sm text-xs text-muted-foreground">{hint}</span>}
          <span className="mt-1 rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-foreground">
            اختار ملف
          </span>
        </>
      )}
      {chosen && onClear && (
        <button
          type="button"
          onClick={(e) => {
            // Inside the label: remove the file, don't open the picker.
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
          className="absolute end-3 top-3 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-500/20"
        >
          إزالة
        </button>
      )}
    </label>
  );
}

function VideoIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="14" height="14" rx="3" />
      <path d="m16 10 6-3v10l-6-3z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
