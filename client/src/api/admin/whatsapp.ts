import { apiClient } from "../client";

/** Connection state of the platform's WhatsApp bridge (mirrors the backend). */
export type WhatsappStatus =
  | "disabled"
  | "init"
  | "qr"
  | "connecting"
  | "connected"
  | "disconnected"
  | "logged_out"
  | "error";

export interface WhatsappStatusResult {
  status: WhatsappStatus;
  /** The linked number — the number every WhatsApp message is sent FROM. */
  phone: string | null;
  since: string | null;
  lastError: string | null;
  /** Teacher's switch: whether the AI agent answers incoming messages. */
  aiRepliesEnabled: boolean;
}

export interface WhatsappQrResult {
  status: WhatsappStatus;
  /** PNG data: URL to scan, present only while status === "qr". */
  qr: string | null;
}

export interface WhatsappSendTestResult {
  sent: boolean;
  ready: boolean;
  messageId: string | null;
  reason: string;
}

export const adminWhatsappApi = {
  status: () => apiClient.get<WhatsappStatusResult>("/admin/whatsapp/status"),
  qr: () => apiClient.get<WhatsappQrResult>("/admin/whatsapp/qr"),
  /** Unlink the current number + wipe the session, then produce a fresh QR. */
  logout: () => apiClient.post<WhatsappStatusResult>("/admin/whatsapp/logout"),
  /** Restart the socket without wiping the session. */
  restart: () => apiClient.post<WhatsappStatusResult>("/admin/whatsapp/restart"),
  /** Turn the AI agent's replies to incoming messages on/off. */
  setAiReplies: (enabled: boolean) =>
    apiClient.put<WhatsappStatusResult>("/admin/whatsapp/ai-replies", { enabled }),
  /** Send a one-off test message from the linked number. */
  sendTest: (phone: string, text: string) =>
    apiClient.post<WhatsappSendTestResult>("/admin/whatsapp/test", { phone, text }),
};
