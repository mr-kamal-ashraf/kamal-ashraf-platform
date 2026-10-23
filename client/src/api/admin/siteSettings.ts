import { apiClient } from "../client";
import type { Palette } from "@/config/theme";
import type {
  AssetSlot,
  RawSiteSettings,
  SettingsSection,
} from "@/shared/site-settings/types";

type SettingsResponse = { settings: RawSiteSettings };

function imageForm(file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return formData;
}

/** Admin editor for the website's appearance & content ("المظهر والمحتوى"). */
export const adminSiteSettingsApi = {
  get: () => apiClient.get<SettingsResponse>("/admin/settings"),

  saveSection: (section: SettingsSection, data: unknown) =>
    apiClient.put<SettingsResponse>(`/admin/settings/${section}`, data),

  resetSection: (section: SettingsSection) =>
    apiClient.delete<SettingsResponse>(`/admin/settings/${section}`),

  uploadAsset: (palette: Palette, slot: AssetSlot, file: File) =>
    apiClient.post<SettingsResponse>(
      `/admin/settings/assets/${palette}/${slot}`,
      imageForm(file),
    ),

  clearAsset: (palette: Palette, slot: AssetSlot) =>
    apiClient.delete<SettingsResponse>(`/admin/settings/assets/${palette}/${slot}`),

  uploadFavicon: (file: File) =>
    apiClient.post<SettingsResponse>("/admin/settings/favicon", imageForm(file)),

  clearFavicon: () => apiClient.delete<SettingsResponse>("/admin/settings/favicon"),
};

/**
 * Tells the Next.js server to drop its cached copy of the settings so the
 * website shows the change on the next page load. Best effort.
 */
export async function revalidateSiteSettings(): Promise<void> {
  try {
    await fetch("/api/revalidate-settings", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // the 60s cache window will catch up anyway
  }
}
