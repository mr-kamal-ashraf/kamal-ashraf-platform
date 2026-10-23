import axios from "axios";
import crypto from "crypto";
import fs from "fs";
import { getBunnyClient, isBunnyConfigured } from "./bunny.client";
import { env } from "../../config/env";
import { VIDEO_STATUS, type VideoStatus } from "../../config/constants";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";

// Shape of the response Bunny returns when a new video entry is created.
interface CreateVideoResponse {
  guid: string;
  title: string;
  status: number;
  length: number;
}

/**
 * Pulls the useful bits out of a failed Bunny API call (HTTP status + Bunny's
 * own response body) for logging. Before this, a bad/expired BUNNY_API_KEY or
 * a wrong BUNNY_LIBRARY_ID on a deploy (e.g. Railway has a stale value that
 * doesn't match what's in the local .env) surfaced as a raw unhandled axios
 * error — which the global error middleware has no specific case for, so it
 * fell all the way through to the generic "حصل خطأ غير متوقع" 500 with
 * nothing in the logs to say WHY. Now it's logged with enough detail to tell
 * "wrong credentials" (401/403) apart from "Bunny is down" (network/5xx).
 */
function describeBunnyError(err: unknown) {
  if (axios.isAxiosError(err)) {
    return {
      status: err.response?.status,
      data: err.response?.data,
      code: err.code,
      message: err.message,
    };
  }
  return err instanceof Error ? { message: err.message } : { value: err };
}

/**
 * Creates a new (empty) video entry in Bunny Stream and returns its GUID.
 * The actual video file is uploaded separately via uploadVideoFile().
 */
export async function createBunnyVideo(title: string): Promise<string> {
  const client = getBunnyClient();
  let data: CreateVideoResponse | undefined;
  try {
    const resp = await client.post<CreateVideoResponse>("/videos", {
      title,
    });
    data = resp.data;
  } catch (err) {
    logger.error("Bunny create-video request failed", {
      error: describeBunnyError(err),
    });
    throw ApiError.internal("خدمة الفيديو مش متاحة حالياً، حاول تاني بعدين.");
  }
  if (!data?.guid) {
    throw ApiError.internal("معلش، حصلت مشكلة في رفع الفيديو، حاول تاني.");
  }
  return data.guid;
}

/**
 * Streams a local video file to Bunny Stream using chunked upload.
 * Content-Length is required by Bunny — we get it from the file stat.
 */
export async function uploadVideoFile(
  videoId: string,
  filePath: string
): Promise<void> {
  const client = getBunnyClient();
  let size: number;
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size <= 0) {
      throw new Error("Video upload source is not a non-empty file");
    }
    size = stat.size;
  } catch (err) {
    logger.error("Bunny upload-video source file is unavailable", {
      videoId,
      filePath,
      error: err instanceof Error ? err.message : err,
    });
    throw ApiError.internal("Video source file is unavailable for upload.");
  }

  const stream = fs.createReadStream(filePath);

  try {
    const resp = await client.put(`/videos/${videoId}`, stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": size,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Keep the upload a true stream: with redirects enabled axios holds every
      // sent chunk in memory (up to the whole 2 GB video) to be able to replay it.
      maxRedirects: 0,
      // No time cap: a video upload can easily exceed the client's default 60s
      // timeout, and an aborted upload leaves Bunny with a 0-byte video.
      timeout: 0,
    });

    logger.info("Bunny video upload completed", { videoId, status: resp.status, size });
  } catch (err) {
    stream.destroy();
    logger.error("Bunny upload-video request failed", {
      videoId,
      error: describeBunnyError(err),
    });
    throw ApiError.internal("معلش، حصلت مشكلة أثناء رفع الفيديو، حاول تاني.");
  }
}

interface BunnyVideoInfo {
  guid: string;
  title: string;
  length: number;          // duration in seconds (may be 0 while video is still encoding)
  status: number;
  encodeProgress: number;  // 0–100
  thumbnailFileName: string;
  width: number;
  height: number;
  framerate: number;
}

// Bunny's video status codes (VideoModelStatus).
const BUNNY_FINISHED = 4;
const BUNNY_FAILED = new Set([5 /* Error */, 6 /* UploadFailed */]);

/**
 * Whether students can watch the video yet. Only "Finished" counts: before
 * that the playlist may be missing or partial, which plays as a black screen.
 */
export function videoStatusFromBunny(info: BunnyVideoInfo): VideoStatus {
  if (BUNNY_FAILED.has(info.status)) return VIDEO_STATUS.FAILED;
  if (info.status === BUNNY_FINISHED) return VIDEO_STATUS.READY;
  return VIDEO_STATUS.PROCESSING;
}

/**
 * Fetches metadata for a Bunny video (duration, resolution, status, etc.).
 * Note: duration may be 0 if the video hasn't finished encoding yet.
 */
export async function getBunnyVideoInfo(
  videoId: string
): Promise<BunnyVideoInfo> {
  const client = getBunnyClient();
  const { data } = await client.get<BunnyVideoInfo>(`/videos/${videoId}`);
  return data;
}

/**
 * Deletes a video from Bunny Stream. Errors are swallowed with a warning
 * because the video may have already been manually deleted from the dashboard.
 */
export async function deleteBunnyVideo(videoId: string): Promise<void> {
  const client = getBunnyClient();
  try {
    await client.delete(`/videos/${videoId}`);
  } catch (err) {
    logger.warn("Failed to delete Bunny video (may already be deleted)", {
      videoId,
      error: err instanceof Error ? err.message : err,
    });
  }
}

interface SignedUrlOptions {
  videoId: string;
  ipAddress?: string;
  ttlSeconds?: number;
  pathSuffix?: string;
}

/**
 * Legacy Bunny playback token (single exact path).
 * Token = base64url( sha256( token_security_key + url_path + expires + [ip] ) )
 */
function generateSignedPlaybackUrlLegacy(options: SignedUrlOptions): string {
  const ttl = options.ttlSeconds ?? env.BUNNY_SIGNED_URL_TTL_SECONDS;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const suffix = options.pathSuffix ?? "playlist.m3u8";
  const path = `/${options.videoId}/${suffix}`;
  const ip = options.ipAddress ?? "";

  const hashInput = `${env.BUNNY_TOKEN_AUTH_KEY}${path}${expires}${ip}`;
  const tokenBuffer = crypto.createHash("sha256").update(hashInput).digest();
  const token = base64Url(tokenBuffer);

  const baseUrl = `https://${env.BUNNY_PULL_ZONE}${path}`;
  return `${baseUrl}?token=${token}&expires=${expires}`;
}

/**
 * Advanced directory-scoped signing (matches BunnyCDN.TokenAuthentication Node helper).
 * Lets one token authorize playlist.m3u8, variant playlists, and segments
 * under `/{videoId}/` — required for HLS + token auth on the pull zone.
 */
function generateSignedPlaybackUrlDirectory(options: SignedUrlOptions): string {
  const ttl = options.ttlSeconds ?? env.BUNNY_SIGNED_URL_TTL_SECONDS;
  const expires = String(Math.floor(Date.now() / 1000) + ttl);
  const suffix = options.pathSuffix ?? "playlist.m3u8";
  const videoId = options.videoId;
  const pathAllowed = `/${videoId}/`;
  const pathname = `/${videoId}/${suffix}`;
  const pullZone = env.BUNNY_PULL_ZONE!;
  const userIp = options.ipAddress ?? "";

  const parsed = new URL(`https://${pullZone}${pathname}`);
  const parameters: Record<string, string> = { token_path: pathAllowed };
  const sortedEntries = Object.entries(parameters).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const signingData = sortedEntries.map(([k, v]) => `${k}=${v}`).join("&");
  const urlData = sortedEntries
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const signaturePath = pathAllowed;
  const message = `${signaturePath}${expires}${signingData}${userIp}`;
  const digest = crypto
    .createHmac("sha256", env.BUNNY_TOKEN_AUTH_KEY!)
    .update(message)
    .digest();
  const token =
    "HS256-" +
    digest
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const tail = urlData ? `&${urlData}` : "";
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}?token=${token}${tail}&expires=${expires}`;
}

/**
 * Generate a Bunny token-authenticated playback URL for HLS (and related files).
 * Defaults to directory-scoped advanced signing; set BUNNY_PLAYBACK_TOKEN_LEGACY=true
 * for pull zones that still use the older single-path SHA256 token only.
 */
export function generateSignedPlaybackUrl(options: SignedUrlOptions): string {
  if (!isBunnyConfigured()) {
    throw ApiError.internal("خدمة الفيديو مش متاحة حالياً، حاول تاني بعدين.");
  }

  // Drop the caller-supplied IP unless IP binding is explicitly enabled. Bunny
  // hashes the IP into the signature, so signing with an IP that doesn't match
  // what Bunny sees on the browser's request is a guaranteed 403 — and callers
  // pass req.ip unconditionally. Centralised here so both signing paths agree;
  // see BUNNY_TOKEN_BIND_IP in config/env.ts for why this defaults to off.
  const effective: SignedUrlOptions = {
    ...options,
    ipAddress: env.BUNNY_TOKEN_BIND_IP ? options.ipAddress : undefined,
  };

  if (env.BUNNY_PLAYBACK_TOKEN_LEGACY) {
    return generateSignedPlaybackUrlLegacy(effective);
  }
  return generateSignedPlaybackUrlDirectory(effective);
}

/** Returns the Bunny CDN URL for the auto-generated video poster JPEG (Stream default). */
export function generateThumbnailUrl(videoId: string): string {
  if (!env.BUNNY_PULL_ZONE) return "";
  return `https://${env.BUNNY_PULL_ZONE}/${videoId}/thumbnail.jpg`;
}

/** Returns the Bunny CDN URL for the animated video preview (WebP). */
export function generatePreviewUrl(videoId: string): string {
  if (!env.BUNNY_PULL_ZONE) return "";
  return `https://${env.BUNNY_PULL_ZONE}/${videoId}/preview.webp`;
}

// Converts a standard base64 string to the URL-safe variant (RFC 4648 §5).
// Bunny's token auth expects this exact encoding.
function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
