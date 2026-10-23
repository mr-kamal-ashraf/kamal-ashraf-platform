import { Router } from "express";
import {
  whatsappStatus,
  whatsappQr,
  whatsappLogout,
  whatsappRestart,
  whatsappSendTest,
  whatsappSetAiReplies,
} from "./whatsapp-bridge.admin.controller";
import { asyncHandler } from "../../shared/utils/asyncHandler";

/**
 * Admin router for the WhatsApp bridge.
 * Mounted at /admin/whatsapp; the parent admin router already enforces the
 * admin JWT, so no extra auth middleware is needed here.
 */
const router = Router();

/** GET /admin/whatsapp/status — connection state + linked number. */
router.get("/status", asyncHandler(whatsappStatus));

/** GET /admin/whatsapp/qr — QR (PNG data URL) to link the number. */
router.get("/qr", asyncHandler(whatsappQr));

/** POST /admin/whatsapp/logout — unlink + wipe session, produce a fresh QR. */
router.post("/logout", asyncHandler(whatsappLogout));

/** POST /admin/whatsapp/restart — restart the socket, keep the session. */
router.post("/restart", asyncHandler(whatsappRestart));

/** PUT /admin/whatsapp/ai-replies — switch the AI agent's replies on/off. */
router.put("/ai-replies", asyncHandler(whatsappSetAiReplies));

/** POST /admin/whatsapp/test — send a manual test message from the linked number. */
router.post("/test", asyncHandler(whatsappSendTest));

export default router;
