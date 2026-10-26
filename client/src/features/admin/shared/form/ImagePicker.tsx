"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { isOptimizable } from "@/shared/lib/images";
import { FileDrop } from "./FileDrop";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** A picked file's address for a preview — freed when the file changes or goes. */
export function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/**
 * A course or lesson picture: drop or pick one, see it right away. `imageUrl`
 * is what's shown (the stored picture, or a picked one before it's saved).
 */
export function ImagePicker({
  imageUrl,
  onFile,
  onClear,
  busy,
}: {
  imageUrl: string | null;
  onFile: (file: File) => void;
  onClear?: () => void;
  busy?: boolean;
}) {
  return (
    <FileDrop
      accept={IMAGE_ACCEPT}
      maxBytes={IMAGE_MAX_BYTES}
      onFile={onFile}
      icon="image"
      title="اسحب الصورة هنا أو اختارها"
      hint="صورة بالعرض (زي ١٢٨٠×٧٢٠) — JPG أو PNG أو WEBP، لحد ٥ ميجا. من غير صورة هيظهر تصميم بألوان المرحلة."
      wrongTypeMessage="الصورة لازم تكون JPG أو PNG أو WEBP."
      tooBigMessage="الصورة أكبر من ٥ ميجا — صغّرها وجرّب تاني."
      compact
      disabled={busy}
      onClear={onClear}
      chosen={
        imageUrl ? (
          <span className="flex w-full flex-col items-center gap-2">
            <span className="relative block aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-border">
              <Image
                src={imageUrl}
                alt=""
                fill
                sizes="320px"
                unoptimized={!isOptimizable(imageUrl)}
                className="object-cover"
              />
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {busy ? "جارٍ رفع الصورة..." : "دوس هنا عشان تغيّرها"}
            </span>
          </span>
        ) : undefined
      }
    />
  );
}
