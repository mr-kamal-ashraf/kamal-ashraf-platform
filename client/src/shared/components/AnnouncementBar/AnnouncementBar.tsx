"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAnnouncementLive, useSiteSettings } from "@/shared/site-settings";

/** Changes whenever the teacher edits the announcement, so a new one shows again. */
function dismissKey(text: string, updatedAt: string | null) {
  let hash = 0;
  for (const ch of `${text}|${updatedAt ?? ""}`) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `announcement-dismissed:${hash}`;
}

/**
 * Thin bar above the navbar for offers & news, managed from the admin panel
 * (text, optional link, start/end dates). Visitors can close it; it stays
 * closed for them until the teacher changes the announcement.
 */
export function AnnouncementBar() {
  const { announcement, updatedAt } = useSiteSettings();
  const live = isAnnouncementLive(announcement);
  const key = dismissKey(announcement.text, updatedAt);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(key) === "1");
    } catch {
      // storage unavailable — just show it
    }
  }, [key]);

  if (!live || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
  };

  const external = /^https?:\/\//i.test(announcement.linkUrl);

  return (
    <div className="relative bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-x-3 gap-y-1 px-10 py-2.5 text-center text-xs font-bold sm:text-sm">
        <p className="leading-relaxed">
          {announcement.text}
          {announcement.linkUrl && (
            <>
              {" "}
              {external ? (
                <a
                  href={announcement.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-1 inline-flex items-center gap-1 underline decoration-2 underline-offset-4 hover:opacity-85"
                >
                  {announcement.linkLabel || "اعرف أكتر"} ←
                </a>
              ) : (
                <Link
                  href={announcement.linkUrl}
                  className="ms-1 inline-flex items-center gap-1 underline decoration-2 underline-offset-4 hover:opacity-85"
                >
                  {announcement.linkLabel || "اعرف أكتر"} ←
                </Link>
              )}
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="إغلاق الإعلان"
        className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-white/15"
      >
        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
