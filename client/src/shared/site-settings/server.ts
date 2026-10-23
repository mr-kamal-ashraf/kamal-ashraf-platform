import { cache } from "react";
import { unstable_cache } from "next/cache";
import { API_URL } from "@/config/env";
import { resolveSiteSettings } from "./resolve";
import type { RawSiteSettings, SiteSettings } from "./types";

/** Cache tag busted by /api/revalidate-settings after the teacher saves. */
export const SITE_SETTINGS_TAG = "site-settings";

/**
 * The saved settings, or null when the API can't be reached. The null is
 * cached like any answer: a plain fetch cache keeps serving the last saved
 * settings forever while the API is down, whereas this switches the website
 * to the built-in defaults within SETTINGS_TTL seconds — and back to the
 * saved settings once the API returns. Pages stay statically cached in
 * between (one background refresh per TTL at most), and a teacher's save
 * shows at once via the tag.
 */
const SETTINGS_TTL = 10;

const loadSavedSettings = unstable_cache(
  async (): Promise<RawSiteSettings | null> => {
    try {
      const res = await fetch(`${API_URL}/settings`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: { settings?: RawSiteSettings };
      };
      return json.data?.settings ?? null;
    } catch {
      return null;
    }
  },
  ["site-settings"],
  { revalidate: SETTINGS_TTL, tags: [SITE_SETTINGS_TAG] },
);

/**
 * Server-only: the appearance & content settings for this render, deduped
 * per request. Built-in defaults fill whatever wasn't saved — or everything,
 * when the API is down.
 */
export const getSiteSettings = cache(
  async (): Promise<SiteSettings> =>
    resolveSiteSettings(await loadSavedSettings()),
);
