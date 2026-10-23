import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import { recordAuditLog } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../audit-logs/audit-log.model";
import * as settingsService from "./site-settings.service";
import { SECTION_SCHEMAS } from "./site-settings.validation";
import type { AssetSlot, Palette, SettingsSection } from "./site-settings.model";

function audit(req: Request, changes: Record<string, unknown>) {
  return recordAuditLog({
    adminId: req.user!.id,
    action: AUDIT_ACTIONS.UPDATE_SITE_SETTINGS,
    metadata: changes,
    ipAddress: req.ip || "",
    userAgent: req.get("user-agent") || "",
  });
}

/** GET /settings — public, cached. Used by the website on every page render. */
export async function getPublic(_req: Request, res: Response) {
  const settings = await settingsService.getPublicSettings();
  res.set("Cache-Control", "public, max-age=15");
  return sendSuccess(res, { data: { settings } });
}

/** GET /admin/settings — fresh copy for the admin editor. */
export async function adminGet(_req: Request, res: Response) {
  const settings = await settingsService.getAdminSettings();
  return sendSuccess(res, { data: { settings } });
}

/** PUT /admin/settings/:section — replaces one section after validating it. */
export async function adminUpdateSection(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const section = req.params.section as SettingsSection;
  const parsed = SECTION_SCHEMAS[section].safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  const settings = await settingsService.updateSection(
    section,
    parsed.data as Record<string, unknown>,
    req.user.id
  );
  await audit(req, { section });
  return sendSuccess(res, { message: "تم حفظ التعديلات", data: { settings } });
}

/** DELETE /admin/settings/:section — puts one section back to the defaults. */
export async function adminResetSection(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const section = req.params.section as SettingsSection;
  const settings = await settingsService.updateSection(section, null, req.user.id);
  await audit(req, { section, reset: true });
  return sendSuccess(res, {
    message: "رجعنا القسم للإعدادات الافتراضية",
    data: { settings },
  });
}

/** POST /admin/settings/assets/:palette/:slot — uploads a palette image. */
export async function adminUploadAsset(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest("لازم ترفع صورة", "NO_FILE");
  const { palette, slot } = req.params as { palette: Palette; slot: AssetSlot };
  const settings = await settingsService.setAsset(
    palette,
    slot,
    req.file.filename,
    req.user.id
  );
  await audit(req, { asset: `${palette}.${slot}` });
  return sendSuccess(res, { message: "تم رفع الصورة", data: { settings } });
}

/** DELETE /admin/settings/assets/:palette/:slot — back to the shipped image. */
export async function adminClearAsset(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { palette, slot } = req.params as { palette: Palette; slot: AssetSlot };
  const settings = await settingsService.clearAsset(palette, slot, req.user.id);
  await audit(req, { asset: `${palette}.${slot}`, reset: true });
  return sendSuccess(res, { message: "رجعنا الصورة الأصلية", data: { settings } });
}

/** POST /admin/settings/favicon — uploads the browser-tab icon. */
export async function adminUploadFavicon(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest("لازم ترفع صورة", "NO_FILE");
  const settings = await settingsService.setFavicon(req.file.filename, req.user.id);
  await audit(req, { asset: "favicon" });
  return sendSuccess(res, { message: "تم رفع الأيقونة", data: { settings } });
}

/** DELETE /admin/settings/favicon — back to the logo as the tab icon. */
export async function adminClearFavicon(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const settings = await settingsService.setFavicon(null, req.user.id);
  await audit(req, { asset: "favicon", reset: true });
  return sendSuccess(res, { message: "رجعنا الأيقونة الأصلية", data: { settings } });
}
