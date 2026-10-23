import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { ApiError } from "../../shared/utils/ApiError";
import {
  getBridgeStatus,
  getBridgeQr,
  logoutBridge,
  restartBridge,
  sendWhatsappText,
  setAiRepliesEnabled,
} from "./whatsapp-bridge.service";

/**
 * Admin-facing controls for the WhatsApp bridge (Baileys).
 * All mounted under /admin/whatsapp (admin JWT enforced by the parent router).
 *
 * The teacher links the platform's support number ONCE by opening the WhatsApp
 * page in the admin panel, which polls GET /qr and shows the QR to scan from
 * WhatsApp → Linked Devices. After scanning, the session is stored in MongoDB
 * and survives redeploys, so this is normally a one-time step.
 */

/**
 * GET /admin/whatsapp/status
 * Current connection state: disabled | init | qr | connecting | connected |
 * disconnected | logged_out | error, plus the linked number when connected.
 */
export async function whatsappStatus(_req: Request, res: Response) {
  return sendSuccess(res, {
    message: "WhatsApp bridge status",
    data: getBridgeStatus(),
  });
}

/**
 * GET /admin/whatsapp/qr
 * Returns the current QR as a PNG data: URL when the bridge is waiting to be
 * linked (status "qr"); otherwise qr is null and status tells the panel what to
 * show instead (e.g. already "connected").
 */
export async function whatsappQr(_req: Request, res: Response) {
  return sendSuccess(res, {
    message: "WhatsApp bridge QR",
    data: getBridgeQr(),
  });
}

/**
 * POST /admin/whatsapp/logout
 * Unlinks the current number and wipes the stored session, then restarts so a
 * fresh QR is produced. Used to switch the platform to a different number.
 */
export async function whatsappLogout(_req: Request, res: Response) {
  await logoutBridge();
  return sendSuccess(res, {
    message: "تم فصل الرقم — امسح كود جديد لإعادة الربط",
    data: getBridgeStatus(),
  });
}

/**
 * POST /admin/whatsapp/restart
 * Restarts the socket WITHOUT wiping the session — recovers a stuck connection
 * without needing a new QR scan.
 */
export async function whatsappRestart(_req: Request, res: Response) {
  await restartBridge();
  return sendSuccess(res, {
    message: "تمت إعادة تشغيل اتصال الواتساب",
    data: getBridgeStatus(),
  });
}

/**
 * PUT /admin/whatsapp/ai-replies  { enabled: boolean }
 * The teacher's switch for the AI support agent. true  -> the linked number
 * answers incoming messages; false -> incoming messages get no reply. Outgoing
 * system messages (parent reports, lesson alerts) are NOT affected.
 */
export async function whatsappSetAiReplies(req: Request, res: Response) {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    throw ApiError.badRequest("القيمة لازم تكون true أو false", "ENABLED_REQUIRED");
  }
  await setAiRepliesEnabled(enabled);
  return sendSuccess(res, {
    message: enabled ? "تم تشغيل رد الذكاء الاصطناعي" : "تم إيقاف رد الذكاء الاصطناعي",
    data: getBridgeStatus(),
  });
}

/**
 * POST /admin/whatsapp/restart handled above. Below: a manual test send.
 *
 * POST /admin/whatsapp/test  { phone, text }
 * Sends a one-off WhatsApp message from the linked number so the teacher can
 * verify the bridge end-to-end. Returns the raw send result (sent/ready/reason)
 * so the panel can show exactly what happened.
 */
export async function whatsappSendTest(req: Request, res: Response) {
  const phone = String((req.body?.phone ?? "") as string).trim();
  const text = String((req.body?.text ?? "") as string).trim();

  if (!phone) {
    throw ApiError.badRequest("اكتب رقم الموبايل الأول", "PHONE_REQUIRED");
  }
  if (!text) {
    throw ApiError.badRequest("اكتب نص الرسالة الأول", "TEXT_REQUIRED");
  }
  if (text.length > 4000) {
    throw ApiError.badRequest("الرسالة طويلة جدًا", "TEXT_TOO_LONG");
  }

  const result = await sendWhatsappText(phone, text);

  return sendSuccess(res, {
    message: result.sent
      ? "تم إرسال الرسالة"
      : "لم تُرسل الرسالة",
    data: result,
  });
}
