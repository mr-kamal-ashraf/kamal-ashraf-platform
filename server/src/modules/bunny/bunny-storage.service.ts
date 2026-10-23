import crypto from "crypto";
import { createReadStream } from "fs";
import fs from "fs/promises";
import axios from "axios";
import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";

/**
 * Bunny Storage (NOT Bunny Stream — that's a separate product for video).
 * Used ONLY to keep a persistent copy of the original curriculum PDF the
 * teacher uploaded, so the admin panel can offer a "فتح الرابط الأصلي"
 * link later. The AI indexing pipeline does NOT read from this URL — the
 * backend streams the PDF binary straight to n8n's webhook.
 *
 * API surface:
 *   PUT    https://storage.bunnycdn.com/{zone}/{path}   (upload/overwrite)
 *   DELETE https://storage.bunnycdn.com/{zone}/{path}   (remove)
 *
 * Auth: single "AccessKey" header (the storage zone's password). Keep in .env.
 *
 * Public delivery: https://{pullZoneHost}/{path}  — served from the CDN's
 * pull zone attached to this storage zone.
 */

export function isBunnyStorageConfigured(): boolean {
  return !!(
    env.BUNNY_STORAGE_ZONE_NAME &&
    env.BUNNY_STORAGE_ACCESS_KEY &&
    env.BUNNY_STORAGE_PULL_ZONE
  );
}

function normalizeFolder(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, "");
}

/**
 * True when a URL is served from THIS project's Bunny Storage pull zone.
 * Guards destroy() so we never delete something that isn't ours (e.g. legacy
 * Cloudinary URLs still in old Curriculum rows).
 */
export function isBunnyCurriculumUrl(url: string): boolean {
  if (!env.BUNNY_STORAGE_PULL_ZONE) return false;
  try {
    const u = new URL(url);
    return u.hostname === env.BUNNY_STORAGE_PULL_ZONE;
  } catch {
    return false;
  }
}

/**
 * Upload a local PDF file into this teacher's curriculum folder on Bunny
 * Storage.
 *
 * Every upload gets its OWN path (folder/teacherId_bookId_<stamp>.pdf). It used
 * to be a fixed folder/teacherId_bookId.pdf that a re-upload overwrote in place,
 * but the pull zone keeps serving the cached copy of an unchanged URL — so the
 * admin's "فتح الرابط الأصلي" kept opening the OLD book after a replacement — and
 * a replacement that failed or was cancelled had already overwritten (and then
 * deleted) the file the restored book still pointed to. A fresh URL per upload
 * avoids both; callers delete the superseded copy once it is no longer needed.
 *
 * Returns the public CDN URL the frontend can hand out as a direct link.
 */
export async function uploadCurriculumPdfToBunny(
  teacherId: string,
  bookId: string,
  filePath: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  if (!isBunnyStorageConfigured()) {
    throw new Error("Bunny Storage is not configured");
  }
  const folder = normalizeFolder(env.BUNNY_CURRICULUM_FOLDER);
  const fileName = `${teacherId}_${bookId}_${Date.now()}_${crypto
    .randomBytes(3)
    .toString("hex")}.pdf`;
  const storagePath = folder ? `${folder}/${fileName}` : fileName;
  const size = (await fs.stat(filePath)).size;
  const uploadUrl = `https://storage.bunnycdn.com/${encodeURIComponent(
    env.BUNNY_STORAGE_ZONE_NAME!,
  )}/${storagePath}`;

  // A flaky network or a Bunny 5xx should not fail an upload the admin may
  // have waited minutes for: retry transient errors a couple of times, each
  // attempt with a fresh stream. Auth / zone errors (401/403/404) fail at once.
  for (let attempt = 1; ; attempt++) {
    // The file is STREAMED from disk. `maxRedirects: 0` is what keeps it that
    // way: axios' redirect handler otherwise keeps a copy of every body chunk
    // it sends (so it could replay them after a redirect), i.e. the whole PDF
    // ends up in memory anyway — measured +300 MB for a 300 MB file, versus
    // ~+35 MB with this option. Bunny Storage never redirects an upload.
    const body = createReadStream(filePath);
    try {
      await axios.put(uploadUrl, body, {
        headers: {
          AccessKey: env.BUNNY_STORAGE_ACCESS_KEY!,
          "Content-Type": "application/pdf",
          "Content-Length": size,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        maxRedirects: 0,
        timeout: 120_000,
      });
      break;
    } catch (err) {
      body.destroy();
      if (attempt >= UPLOAD_ATTEMPTS || !isTransientUploadError(err)) throw err;
      logger.warn("Bunny Storage upload failed, retrying", {
        attempt,
        error: err instanceof Error ? err.message : err,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, UPLOAD_RETRY_DELAY_MS * attempt),
      );
    }
  }

  const publicUrl = `https://${env.BUNNY_STORAGE_PULL_ZONE}/${storagePath}`;
  return { publicUrl, storagePath };
}

const UPLOAD_ATTEMPTS = 3;
const UPLOAD_RETRY_DELAY_MS = 1_000;

/** Network blips, timeouts, 429 and 5xx are worth another try; everything else is not. */
function isTransientUploadError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  if (status !== undefined) return status === 429 || status >= 500;
  return err.code !== "ERR_CANCELED";
}

/**
 * Upload ONE cropped question image (PNG) extracted by the AI indexing
 * pipeline (n8n's WF1b) from a curriculum page — a diagram/illustration that
 * belongs to a specific question, so the exam generator can later reuse the
 * REAL image instead of describing it. Called from the internal n8n-facing
 * route, never directly by a browser.
 *
 * Path includes page + a per-page image index because one page can carry
 * several question images (e.g. a row of small icons, one per sub-question).
 * Deterministic path => re-ingesting the same book/page/index overwrites the
 * old crop instead of accumulating stale copies.
 */
export async function uploadQuestionImageToBunny(
  teacherId: string,
  bookId: string,
  pageNumber: number,
  imageIndex: number,
  imageBuffer: Buffer,
): Promise<{ publicUrl: string; storagePath: string }> {
  if (!isBunnyStorageConfigured()) {
    throw new Error("Bunny Storage is not configured");
  }
  const folder = normalizeFolder(env.BUNNY_CURRICULUM_FOLDER);
  const fileName = `${teacherId}_${bookId}_p${pageNumber}_${imageIndex}.png`;
  const storagePath = folder
    ? `${folder}/question-images/${fileName}`
    : `question-images/${fileName}`;
  const uploadUrl = `https://storage.bunnycdn.com/${encodeURIComponent(
    env.BUNNY_STORAGE_ZONE_NAME!,
  )}/${storagePath}`;

  await axios.put(uploadUrl, imageBuffer, {
    headers: {
      AccessKey: env.BUNNY_STORAGE_ACCESS_KEY!,
      "Content-Type": "image/png",
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 60_000,
  });

  const publicUrl = `https://${env.BUNNY_STORAGE_PULL_ZONE}/${storagePath}`;
  return { publicUrl, storagePath };
}

/**
 * Best-effort delete of a curriculum PDF previously uploaded here.
 * No-op (safely swallowed) when:
 *   - Bunny isn't configured
 *   - The URL isn't ours (e.g. legacy Cloudinary URL — a different service
 *     is responsible for cleaning that one up)
 *   - The Bunny API itself errors out (already deleted, transient network)
 */
export async function destroyCurriculumPdfFromBunny(
  publicUrl: string | null | undefined,
): Promise<void> {
  if (!publicUrl || !isBunnyStorageConfigured()) return;
  if (!isBunnyCurriculumUrl(publicUrl)) return;
  try {
    const u = new URL(publicUrl);
    const storagePath = u.pathname.replace(/^\/+/, "");
    const deleteUrl = `https://storage.bunnycdn.com/${encodeURIComponent(
      env.BUNNY_STORAGE_ZONE_NAME!,
    )}/${storagePath}`;
    await axios.delete(deleteUrl, {
      headers: { AccessKey: env.BUNNY_STORAGE_ACCESS_KEY! },
      timeout: 30_000,
    });
  } catch (err) {
    logger.warn("Bunny Storage delete failed (non-fatal)", {
      publicUrl,
      error: err instanceof Error ? err.message : err,
    });
  }
}
