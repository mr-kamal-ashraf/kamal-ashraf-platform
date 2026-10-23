"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { adminSiteSettingsApi, revalidateSiteSettings } from "@/api";
import {
  describeAdminError,
  toastAdminError,
  type FriendlyError,
} from "@/features/admin/shared/errors";
import type { Palette } from "@/config/theme";
import {
  resolveSiteSettings,
  type AssetSlot,
  type RawSiteSettings,
  type SettingsSection,
  type SiteSettings,
} from "@/shared/site-settings";

interface AppearanceContextValue {
  loading: boolean;
  /** Why the settings couldn't be loaded (null while loading / when loaded). */
  error: FriendlyError | null;
  /** Loads the settings again (after a load error) without reloading the page. */
  reload: () => void;
  raw: RawSiteSettings | null;
  /** Saved settings with defaults filled in — what the website shows now. */
  resolved: SiteSettings;
  busy: boolean;
  saveSection: (section: SettingsSection, data: unknown) => Promise<boolean>;
  resetSection: (section: SettingsSection) => Promise<boolean>;
  uploadAsset: (palette: Palette, slot: AssetSlot, file: File) => Promise<void>;
  clearAsset: (palette: Palette, slot: AssetSlot) => Promise<void>;
  uploadFavicon: (file: File) => Promise<void>;
  clearFavicon: () => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<RawSiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminSiteSettingsApi
      .get()
      .then((res) => {
        if (!res || typeof res.settings !== "object" || res.settings === null) {
          throw new Error("Unexpected /admin/settings response");
        }
        if (!cancelled) setRaw(res.settings);
      })
      .catch((err) => {
        if (!cancelled) setError(describeAdminError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  /** Runs one write, stores the returned settings and refreshes the website cache. */
  const run = useCallback(
    async (
      task: () => Promise<{ settings: RawSiteSettings }>,
      success: string,
    ): Promise<boolean> => {
      setBusy(true);
      try {
        const res = await task();
        if (!res || typeof res.settings !== "object" || res.settings === null) {
          throw new Error("Unexpected /admin/settings response");
        }
        setRaw(res.settings);
        // Best effort: if this fails the website still updates within a minute.
        await revalidateSiteSettings();
        toast.success(success);
        return true;
      } catch (err) {
        toastAdminError(err);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const value = useMemo<AppearanceContextValue>(
    () => ({
      loading,
      error,
      reload,
      raw,
      resolved: resolveSiteSettings(raw),
      busy,
      saveSection: (section, data) =>
        run(() => adminSiteSettingsApi.saveSection(section, data), "تم الحفظ ✓ — التعديل ظاهر على المنصة"),
      resetSection: (section) =>
        run(() => adminSiteSettingsApi.resetSection(section), "رجعنا القسم للإعدادات الافتراضية"),
      uploadAsset: async (palette, slot, file) => {
        await run(() => adminSiteSettingsApi.uploadAsset(palette, slot, file), "تم رفع الصورة");
      },
      clearAsset: async (palette, slot) => {
        await run(() => adminSiteSettingsApi.clearAsset(palette, slot), "رجعنا الصورة الأصلية");
      },
      uploadFavicon: async (file) => {
        await run(() => adminSiteSettingsApi.uploadFavicon(file), "تم رفع الأيقونة");
      },
      clearFavicon: async () => {
        await run(() => adminSiteSettingsApi.clearFavicon(), "رجعنا الأيقونة الأصلية");
      },
    }),
    [loading, error, reload, raw, busy, run],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside AppearanceProvider");
  return ctx;
}
