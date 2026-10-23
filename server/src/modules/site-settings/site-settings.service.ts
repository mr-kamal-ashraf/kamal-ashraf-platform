import fs from "fs";
import path from "path";
import type { Types } from "mongoose";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";
import { THUMBNAILS_DIR } from "../../shared/middlewares/upload.middleware";
import {
  destroyCloudinaryImageByUrl,
  isCloudinaryConfigured,
  uploadSiteImage,
} from "../cloudinary/cloudinary.service";
import {
  SiteSettings,
  type AssetSlot,
  type Palette,
  type SettingsSection,
  type SiteSettingsDocument,
} from "./site-settings.model";

const KEY = "main";

// The public read endpoint is hit on every page render of the website, so the
// settings are kept in memory for a few seconds and dropped on every write.
const CACHE_TTL_MS = 15_000;
let cache: { at: number; value: Record<string, unknown> } | null = null;

function invalidate() {
  cache = null;
}

async function getOrCreate(): Promise<SiteSettingsDocument> {
  const existing = await SiteSettings.findOne({ key: KEY });
  if (existing) return existing;
  try {
    return await SiteSettings.create({ key: KEY });
  } catch {
    // Two first requests raced on the unique key — read the winner.
    const doc = await SiteSettings.findOne({ key: KEY });
    if (!doc) throw ApiError.internal("تعذر تحميل إعدادات المنصة");
    return doc;
  }
}

/** Public, cached view of the settings (overrides only — nulls mean "default"). */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const doc = await SiteSettings.findOne({ key: KEY });
  const value = doc
    ? (doc.toJSON() as Record<string, unknown>)
    : {
        theme: null,
        typography: null,
        hero: null,
        whyUs: null,
        faq: null,
        contact: null,
        announcement: null,
        welcome: null,
        assets: {},
        favicon: null,
        updatedAt: null,
      };
  cache = { at: Date.now(), value };
  return value;
}

/** Fresh (uncached) settings for the admin editor. */
export async function getAdminSettings(): Promise<Record<string, unknown>> {
  const doc = await getOrCreate();
  return doc.toJSON() as Record<string, unknown>;
}

/** Replaces one section with already-validated data (`null` resets it to defaults). */
export async function updateSection(
  section: SettingsSection,
  data: Record<string, unknown> | null,
  adminId: string | Types.ObjectId
) {
  const doc = await getOrCreate();
  doc.set(section, data);
  doc.markModified(section);
  doc.updatedBy = adminId as Types.ObjectId;
  await doc.save();
  invalidate();
  return doc.toJSON() as Record<string, unknown>;
}

/** Uploads a temp image file to Cloudinary and always removes the temp file. */
async function uploadFromTemp(name: string, filename: string): Promise<string> {
  const localFilePath = path.join(THUMBNAILS_DIR, filename);
  try {
    if (!isCloudinaryConfigured()) {
      throw new ApiError(
        500,
        "خدمة رفع الصور مش متاحة حالياً، حاول تاني بعدين.",
        { code: "CLOUDINARY_NOT_CONFIGURED", isOperational: true }
      );
    }
    const { secure_url } = await uploadSiteImage(name, localFilePath);
    return secure_url;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error("Failed to upload site image to Cloudinary", {
      name,
      error: err instanceof Error ? err.message : err,
    });
    throw ApiError.internal("فشل رفع الصورة، حاول تاني.");
  } finally {
    fs.promises.unlink(localFilePath).catch(() => undefined);
  }
}

function readAsset(doc: SiteSettingsDocument, palette: Palette, slot: AssetSlot) {
  return doc.assets?.[palette]?.[slot] ?? null;
}

function writeAsset(
  doc: SiteSettingsDocument,
  palette: Palette,
  slot: AssetSlot,
  url: string | null
) {
  const assets = { ...(doc.assets ?? {}) };
  assets[palette] = { ...(assets[palette] ?? {}), [slot]: url };
  doc.set("assets", assets);
  doc.markModified("assets");
}

/**
 * Saves a doc that now points at a freshly uploaded image. If the save fails,
 * the new upload is deleted again so Cloudinary isn't left with an orphan.
 */
async function saveWithUpload(doc: SiteSettingsDocument, uploadedUrl: string | null) {
  try {
    await doc.save();
  } catch (err) {
    void destroyCloudinaryImageByUrl(uploadedUrl);
    throw err;
  }
}

/** Replaces one palette image (logo / dark logo / hero portrait). */
export async function setAsset(
  palette: Palette,
  slot: AssetSlot,
  filename: string,
  adminId: string | Types.ObjectId
) {
  const url = await uploadFromTemp(`${palette}_${slot}`, filename);
  const doc = await getOrCreate();
  const previous = readAsset(doc, palette, slot);
  writeAsset(doc, palette, slot, url);
  doc.updatedBy = adminId as Types.ObjectId;
  await saveWithUpload(doc, url);
  invalidate();
  void destroyCloudinaryImageByUrl(previous);
  return doc.toJSON() as Record<string, unknown>;
}

/** Puts one palette image back to the image that ships with the platform. */
export async function clearAsset(
  palette: Palette,
  slot: AssetSlot,
  adminId: string | Types.ObjectId
) {
  const doc = await getOrCreate();
  const previous = readAsset(doc, palette, slot);
  writeAsset(doc, palette, slot, null);
  doc.updatedBy = adminId as Types.ObjectId;
  await doc.save();
  invalidate();
  void destroyCloudinaryImageByUrl(previous);
  return doc.toJSON() as Record<string, unknown>;
}

/** Replaces (or, with `filename` null, resets) the browser-tab icon. */
export async function setFavicon(
  filename: string | null,
  adminId: string | Types.ObjectId
) {
  const url = filename ? await uploadFromTemp("favicon", filename) : null;
  const doc = await getOrCreate();
  const previous = doc.favicon;
  doc.favicon = url;
  doc.updatedBy = adminId as Types.ObjectId;
  await saveWithUpload(doc, url);
  invalidate();
  void destroyCloudinaryImageByUrl(previous);
  return doc.toJSON() as Record<string, unknown>;
}
