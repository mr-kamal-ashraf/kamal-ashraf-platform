import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

// Temporary directory for video uploads.
// Videos are stored here while being uploaded to Bunny Stream, then deleted.
const tempUploadDir = path.join(os.tmpdir(), "kamal-ashraf-uploads");
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Permanent directory served at /uploads — thumbnails live here long-term.
export const PERSISTENT_UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
export const THUMBNAILS_DIR = path.join(PERSISTENT_UPLOAD_ROOT, "thumbnails");

// Create the thumbnails directory on startup if it doesn't exist yet.
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// Multer storage for videos: save to temp dir with a random collision-safe name.
// The service layer reads the file from disk, streams it to Bunny, then deletes it.
const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempUploadDir),
  filename: (req, file, cb) => {
    // Random name prevents path traversal and filename collisions.
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const safeExt = sanitizeExt(file.originalname);
    const name = `${unique}${safeExt}`;
    // Remember the path NOW, while the file is still being written: if the
    // browser goes away mid-upload multer never reports the half-written file,
    // so this is the only way to find (and delete) it afterwards.
    trackTempFile(req, path.join(tempUploadDir, name));
    cb(null, name);
  },
});

// Temp files created for a request, so a request that never finishes (or
// fails before its controller runs) can be cleaned up.
const tempFilesByRequest = new WeakMap<object, string[]>();

function trackTempFile(req: object, filePath: string): void {
  const list = tempFilesByRequest.get(req) ?? [];
  list.push(filePath);
  tempFilesByRequest.set(req, list);
}

function removeTrackedTempFiles(req: object): void {
  for (const filePath of tempFilesByRequest.get(req) ?? []) {
    fs.unlink(filePath, () => undefined); // already gone is fine
  }
  tempFilesByRequest.delete(req);
}

/**
 * Put BEFORE the multer middleware. When the client hangs up before the whole
 * request body has arrived (the teacher closes the tab or refreshes in the
 * middle of an upload), delete the half-written temp file. Without this it stays
 * on disk forever — up to 300 MB per aborted book, 2 GB per aborted video.
 * A request whose body arrived completely is untouched: from then on the
 * controller owns the file and deletes it itself, even if the browser is gone.
 */
export function discardAbortedUpload(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.once("close", () => {
    if (!req.complete) removeTrackedTempFiles(req);
  });
  next();
}

/**
 * Put AFTER the route's handlers. Deletes the temp file when something in the
 * chain failed (validation error, bad content, a controller that threw) so a
 * rejected upload never leaves its file behind. Safe if the controller already
 * removed it.
 */
export function discardUploadOnError(
  err: unknown,
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  removeTrackedTempFiles(req);
  next(err);
}

// Multer storage for thumbnails: saved permanently under uploads/thumbnails/.
const thumbnailStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, THUMBNAILS_DIR),
  filename: (_req, file, cb) => {
    const random = crypto.randomBytes(8).toString("hex");
    const safeExt = sanitizeExt(file.originalname) || ".png"; // default to .png if no extension
    cb(null, `thumb-${Date.now()}-${random}${safeExt}`);
  },
});

function sanitizeExt(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  // Allow only simple alphanumeric extensions; ignore anything weird.
  if (!/^\.[a-z0-9]{1,8}$/.test(ext)) return "";
  return ext;
}

/** Browser/OS may send different MIME strings for the same container (e.g. MOV as octet-stream on Windows). */
const allowedVideoMimes = [
  "video/mp4",
  "video/m4v",
  "video/x-m4v",
  "video/quicktime",
  "video/x-quicktime",
  "video/x-matroska",
  "video/matroska",
  "video/webm",
  "video/x-msvideo",
  "video/avi",
  "video/mpeg",
  "video/x-mpeg",
  "video/mp2t",
  "video/3gpp",
  "video/3gpp2",
  "video/ogg",
  "application/octet-stream",
];

const allowedImageMimes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** Some browsers send octet-stream for PDFs picked from certain OS file pickers. */
const allowedPdfMimes = ["application/pdf", "application/octet-stream"];

/**
 * Multer instance for video uploads.
 * - Saves to temp storage (deleted after Bunny upload).
 * - 2 GB file size limit.
 * - Only accepts the MIME types in allowedVideoMimes.
 * NOTE: MIME type can be spoofed by the client, so verifyUploadedVideo() is
 *       run afterwards to check the actual file bytes (magic numbers).
 */
export const videoUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedVideoMimes.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          `صيغة الفيديو ${file.mimetype} غير مدعومة. استخدم MP4 أو MOV أو WEBM أو MKV أو AVI أو صيغ شائعة أخرى.`,
          "INVALID_VIDEO_FORMAT",
        ),
      );
    }
    cb(null, true);
  },
});

/**
 * Multer instance for thumbnail image uploads.
 * - Saves permanently to uploads/thumbnails/.
 * - 5 MB file size limit.
 * - Only accepts the MIME types in allowedImageMimes.
 * Also verified with magic-byte check by verifyUploadedImage().
 */
export const thumbnailUpload = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageMimes.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          "صيغة الصورة دي مش مدعومة. استخدم صورة JPG أو PNG أو WEBP.",
          "INVALID_IMAGE_FORMAT",
          { mimetype: file.mimetype },
        ),
      );
    }
    cb(null, true);
  },
});

/**
 * Multer instance for curriculum PDF uploads (admin panel "منهج المساعد الذكي").
 * - Saves to temp storage — the controller streams it to Cloudinary and
 *   deletes the temp file afterwards (same lifecycle as videoUpload).
 * - 300 MB file size limit — enough for large scanned textbooks; raise if teachers
 *   legitimately hit it.
 * - Only accepts PDF. Also verified with magic-byte check by verifyUploadedPdf().
 */
export const curriculumPdfUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300 MB
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedPdfMimes.includes(file.mimetype)) {
      return cb(
        ApiError.badRequest(
          `صيغة الملف ${file.mimetype} غير مدعومة. ارفع ملف PDF فقط.`,
          "INVALID_PDF_FORMAT",
        ),
      );
    }
    cb(null, true);
  },
});

/** Returns the public URL path for a thumbnail given its filename. */
export function thumbnailPublicUrl(filename: string): string {
  return `/uploads/thumbnails/${filename}`;
}

/**
 * Safely deletes a thumbnail file from disk.
 *
 * Security: normalises the path to a basename and verifies it stays inside
 * THUMBNAILS_DIR before unlinking, preventing path traversal attacks.
 * Skips Bunny CDN URLs (starts with "http") — those are not local files.
 */
export function deleteThumbnailFile(
  publicUrlOrPath: string | null | undefined,
) {
  if (!publicUrlOrPath) return;
  if (publicUrlOrPath.startsWith("http")) return; // Bunny CDN URL — nothing to delete locally
  // Always normalize to a basename so callers can't pass `../../etc/passwd`.
  const filename = path.basename(publicUrlOrPath);
  const fullPath = path.resolve(THUMBNAILS_DIR, filename);
  // Defense in depth: refuse to unlink anything outside THUMBNAILS_DIR.
  if (!fullPath.startsWith(THUMBNAILS_DIR + path.sep)) return;
  fs.unlink(fullPath, () => undefined); // fire-and-forget; errors are intentionally ignored
}

/**
 * Inspect the actual bytes of an uploaded file. The browser-supplied
 * Content-Type is trivial to spoof, so we verify the file signature.
 *
 * Reference: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
type Signature = { offset: number; bytes: number[] };

const IMAGE_SIGNATURES: Signature[] = [
  { offset: 0, bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF87a/89a
  { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (WEBP wrapper)
];

/** True when `ftyp` (ISO BMFF) appears at `offset` — MP4 / MOV / M4V and similar. */
function isFtypAt(buf: Buffer, offset: number): boolean {
  return (
    offset + 4 <= buf.length &&
    buf[offset] === 0x66 &&
    buf[offset + 1] === 0x74 &&
    buf[offset + 2] === 0x79 &&
    buf[offset + 3] === 0x70
  );
}

/**
 * Magic-byte sniffing for common lesson video containers.
 * Keeps multer MIME allowlist + this check so spoofed types cannot upload non-video payloads.
 */
function isRecognizedVideoContent(buf: Buffer): boolean {
  if (buf.length < 4) return false;

  // ISO BMFF (ftyp) + QuickTime / MOV (moov / mdat) — scan first 8 KiB
  const scanEnd = Math.min(buf.length - 4, 8192);
  for (let i = 0; i <= scanEnd; i++) {
    if (isFtypAt(buf, i)) return true;
    if (
      buf[i] === 0x6d &&
      buf[i + 1] === 0x6f &&
      buf[i + 2] === 0x6f &&
      buf[i + 3] === 0x76
    ) {
      return true;
    }
    if (
      buf[i] === 0x6d &&
      buf[i + 1] === 0x64 &&
      buf[i + 2] === 0x61 &&
      buf[i + 3] === 0x74
    ) {
      return true;
    }
  }

  // Matroska / WebM (EBML)
  if (
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return true;
  }

  // AVI: RIFF .... AVI␠
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x41 &&
    buf[9] === 0x56 &&
    buf[10] === 0x49 &&
    buf[11] === 0x20
  ) {
    return true;
  }

  // FLV
  if (
    buf.length >= 4 &&
    buf[0] === 0x46 &&
    buf[1] === 0x4c &&
    buf[2] === 0x56 &&
    buf[3] === 0x01
  ) {
    return true;
  }

  // MPEG program stream (PS)
  if (
    buf.length >= 4 &&
    buf[0] === 0x00 &&
    buf[1] === 0x00 &&
    buf[2] === 0x01 &&
    buf[3] === 0xba
  ) {
    return true;
  }

  // ASF / WMV
  if (
    buf.length >= 16 &&
    buf[0] === 0x30 &&
    buf[1] === 0x26 &&
    buf[2] === 0xb2 &&
    buf[3] === 0x75 &&
    buf[4] === 0x8e &&
    buf[5] === 0x66 &&
    buf[6] === 0xcf &&
    buf[7] === 0x11
  ) {
    return true;
  }

  // Ogg (Theora/Vorbis in .ogv etc.)
  if (
    buf.length >= 4 &&
    buf[0] === 0x4f &&
    buf[1] === 0x67 &&
    buf[2] === 0x67 &&
    buf[3] === 0x53
  ) {
    return true;
  }

  // MPEG transport stream: 0x47 sync at 0 and every 188 bytes
  if (
    buf.length >= 188 * 2 + 1 &&
    buf[0] === 0x47 &&
    buf[188] === 0x47 &&
    buf[188 * 2] === 0x47
  ) {
    return true;
  }

  return false;
}

/** True when the PDF magic bytes ("%PDF-") appear at the very start of the file. */
function isRecognizedPdfContent(buf: Buffer): boolean {
  return (
    buf.length >= 5 &&
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 && // F
    buf[4] === 0x2d // -
  );
}

function matchesAny(buf: Buffer, signatures: Signature[]): boolean {
  return signatures.some((sig) => {
    if (buf.length < sig.offset + sig.bytes.length) return false;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[sig.offset + i] !== sig.bytes[i]) return false;
    }
    return true;
  });
}

async function readFileHead(filePath: string, length = 16): Promise<Buffer> {
  const fd = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buf, 0, length, 0);
    return bytesRead < length ? buf.subarray(0, bytesRead) : buf;
  } finally {
    await fd.close();
  }
}

async function verifyFileSignature(
  filePath: string,
  signatures: Signature[],
): Promise<boolean> {
  try {
    const head = await readFileHead(filePath);
    return matchesAny(head, signatures);
  } catch {
    return false;
  }
}

/**
 * Express middleware: run AFTER multer.single(), inspects req.file's bytes
 * and rejects the request if the magic bytes don't match the claimed type.
 * Cleans up the uploaded file on rejection.
 */
export function verifyUploadedImage(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return next();
  verifyFileSignature(file.path, IMAGE_SIGNATURES)
    .then((ok) => {
      if (!ok) {
        fs.unlink(file.path, () => undefined);
        return next(
          ApiError.badRequest(
            "الملف ده مش صورة سليمة — جرّب صورة تانية بصيغة PNG أو JPG أو WEBP.",
            "INVALID_IMAGE_CONTENT",
          ),
        );
      }
      next();
    })
    .catch((err) => next(err));
}

export function verifyUploadedVideo(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return next();
  readFileHead(file.path, 8192)
    .then((head) => {
      if (!isRecognizedVideoContent(head)) {
        fs.unlink(file.path, () => undefined);
        return next(
          ApiError.badRequest(
            "محتوى الملف لا يطابق فيديو مدعوم (MP4، MOV، WEBM، MKV، AVI، …)",
            "INVALID_VIDEO_CONTENT",
          ),
        );
      }
      next();
    })
    .catch((err) => next(err));
}

export function verifyUploadedPdf(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return next();

  readFileHead(file.path, 8)
    .then((head) => {
      if (!isRecognizedPdfContent(head)) {
        fs.unlink(file.path, () => undefined);
        return next(
          ApiError.badRequest(
            "محتوى الملف لا يطابق ملف PDF صالح",
            "INVALID_PDF_CONTENT",
          ),
        );
      }
      next();
    })
    .catch((err) => next(err));
}
