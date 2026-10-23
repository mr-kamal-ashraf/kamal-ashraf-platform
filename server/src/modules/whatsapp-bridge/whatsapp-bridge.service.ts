/* eslint-disable @typescript-eslint/no-explicit-any --
 * Baileys is an ESM-only package loaded here via a runtime dynamic import
 * (see loadEsm) so it can run inside this CommonJS backend. Its types are
 * therefore not available at compile time, which makes this file the single,
 * isolated "untyped boundary" around the WhatsApp library. Everything the rest
 * of the codebase touches goes through the typed helpers exported at the bottom.
 */
import axios from "axios";
import FormData from "form-data";
import { env } from "../../config/env";
import { logger } from "../../shared/utils/logger";
import { withSafeRetry } from "../../shared/utils/safeRetry";
import { freshConnections } from "../../shared/utils/freshConnections";
import {
  WhatsappSession,
  WhatsappOutboundMessage,
  WhatsappSettings,
  WHATSAPP_SETTINGS_ID,
  ensureWhatsappOutboundMessageIndexes,
} from "./whatsapp-bridge.model";

// ── ESM-from-CommonJS loader ──────────────────────────────────────────────────
// `tsc` with "module": "commonjs" rewrites a normal dynamic import() into a
// require(), which cannot load a pure-ESM package (throws ERR_REQUIRE_ESM). This
// Function wrapper hides the import() from the compiler so it survives to
// runtime as a real dynamic import — the standard, reliable way to pull an ESM
// dependency into a CJS build without switching the whole project to ESM.
const loadEsm: (specifier: string) => Promise<any> = new Function(
  "specifier",
  "return import(specifier);",
) as unknown as (specifier: string) => Promise<any>;

// ── Connection status ─────────────────────────────────────────────────────────
export type BridgeStatus =
  | "disabled" // WHATSAPP_BRIDGE_ENABLED=false — bridge never starts
  | "init" // starting up
  | "qr" // waiting for the teacher to scan the QR code
  | "connecting" // handshaking after a valid session was found
  | "connected" // linked and ready to send/receive
  | "disconnected" // dropped; will auto-reconnect
  | "logged_out" // session invalidated (phone unlinked) — needs a fresh QR
  | "error";

interface BridgeState {
  status: BridgeStatus;
  qrDataUrl: string | null; // last QR as a PNG data: URL (for the admin panel)
  phone: string | null; // the linked number, once connected
  since: string | null; // ISO timestamp of the last "connected"
  lastError: string | null;
}

const state: BridgeState = {
  status: "init",
  qrDataUrl: null,
  phone: null,
  since: null,
  lastError: null,
};

// Module-level socket + guards. One session per process today (see model note).
let sock: any = null;
let baileysRuntime: any = null;
let starting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let stopped = false; // set on graceful shutdown so we don't auto-reconnect

// Teacher's master switch for the AI support agent (persisted in Mongo, loaded
// on bridge start). On by default so behaviour is unchanged until it is turned
// off from the admin panel.
let aiRepliesEnabled = true;

async function loadAiRepliesSetting(): Promise<void> {
  try {
    const doc = await WhatsappSettings.findById(WHATSAPP_SETTINGS_ID).lean();
    aiRepliesEnabled = doc ? doc.aiRepliesEnabled !== false : true;
  } catch (err) {
    // Keep the last known value if Mongo is briefly unavailable.
    logger.error("[whatsapp-bridge] could not load the AI-replies setting", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// Baileys receives a retry receipt when a recipient device cannot decrypt one
// of our outgoing messages. The payload must then be supplied through
// SocketConfig.getMessage so Baileys can encrypt and relay it again. Keep a
// small immediate cache as well as the Mongo store: the cache covers a retry
// that arrives in the few milliseconds before the database write finishes.
const OUTBOUND_MESSAGE_CACHE_LIMIT = 1_000;
const OUTBOUND_MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const recentOutboundMessages = new Map<string, any>();

function cacheOutboundMessage(messageId: string, message: any): void {
  if (!messageId || !message) return;
  if (recentOutboundMessages.size >= OUTBOUND_MESSAGE_CACHE_LIMIT) {
    const oldestId = recentOutboundMessages.keys().next().value;
    if (oldestId !== undefined) recentOutboundMessages.delete(oldestId);
  }
  recentOutboundMessages.set(messageId, message);
}

async function persistOutboundMessage(
  baileys: any,
  messageId: string,
  message: any,
): Promise<void> {
  if (!messageId || !message) return;
  const serialized = JSON.parse(
    JSON.stringify(message, baileys.BufferJSON.replacer),
  );
  await WhatsappOutboundMessage.updateOne(
    { _id: messageId },
    {
      $set: {
        data: serialized,
        expiresAt: new Date(Date.now() + OUTBOUND_MESSAGE_TTL_MS),
      },
    },
    { upsert: true },
  );
}

async function getOutboundMessage(
  baileys: any,
  messageId: string | null | undefined,
): Promise<any | undefined> {
  if (!messageId) return undefined;
  const cached = recentOutboundMessages.get(messageId);
  if (cached) return cached;

  const doc = await WhatsappOutboundMessage.findById(messageId).lean();
  if (!doc?.data) return undefined;
  const message = JSON.parse(
    JSON.stringify(doc.data),
    baileys.BufferJSON.reviver,
  );
  cacheOutboundMessage(messageId, message);
  return message;
}

// ── MongoDB-backed Baileys auth store ─────────────────────────────────────────
// Mirrors Baileys' `useMultiFileAuthState`, but each entry is a document in the
// `whatsapp_sessions` collection instead of a file. `BufferJSON`/`initAuthCreds`
// come from the loaded Baileys module so serialization matches the library.
async function useMongoAuthState(baileys: any) {
  const { BufferJSON, initAuthCreds, proto } = baileys;

  const writeData = async (id: string, value: unknown): Promise<void> => {
    // Double round-trip through BufferJSON is intentional: it turns Node Buffers
    // into base64 markers that Mongo can store, and back again on read.
    const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
    await WhatsappSession.updateOne(
      { _id: id },
      { $set: { data: serialized } },
      { upsert: true },
    );
  };

  const readData = async (id: string): Promise<any> => {
    const doc = await WhatsappSession.findById(id).lean();
    if (!doc || doc.data == null) return null;
    return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
  };

  const removeData = async (id: string): Promise<void> => {
    await WhatsappSession.deleteOne({ _id: id });
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const result: Record<string, any> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              result[id] = value;
            }),
          );
          return result;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const tasks: Promise<void>[] = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const docId = `${category}-${id}`;
              tasks.push(value ? writeData(docId, value) : removeData(docId));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData("creds", creds),
    clearAll: () => WhatsappSession.deleteMany({}),
  };
}

// A Pino-shaped no-op logger. Baileys requires a logger with .child() and the
// standard level methods; we keep it silent to avoid flooding the app logs with
// Signal-protocol noise, and surface only the events we care about ourselves.
function makeSilentLogger(): any {
  const noop = () => undefined;
  const l: any = {
    level: "silent",
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  };
  l.child = () => l;
  return l;
}

// ── Inbound text extraction ────────────────────────────────────────────────────
function extractText(message: any): string {
  if (!message) return "";
  const raw =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.buttonsResponseMessage?.selectedDisplayText ??
    message.listResponseMessage?.title ??
    message.templateButtonReplyMessage?.selectedDisplayText ??
    "";
  return typeof raw === "string" ? raw.trim() : "";
}

// ── Forward an incoming message to n8n (WF13 — the support agent) ───────────────
// The bridge lives inside this backend, so it already knows the platform's
// identity (teacher_id, api host, name) and passes it straight through. WF13
// therefore needs no phone-number lookup — a clean break from the old Meta
// design where Meta posted to n8n and n8n had to resolve the platform itself.
export async function forwardToN8n(input: {
  from: string;
  text: string;
  messageId: string | null;
}): Promise<void> {
  const url = `${env.N8N_WEBHOOK_BASE_URL}/whatsapp-support`;
  try {
    // A message that n8n never received is a customer who gets no answer: when
    // n8n is only briefly unreachable (restart, network blip) wait and try again.
    await withSafeRetry(
      "whatsapp-support",
      () =>
        axios.post(
          url,
          {
            from: input.from,
            text: input.text,
            message_id: input.messageId,
            teacher_id: env.PLATFORM_TEACHER_ID,
            platform_api_host: env.PLATFORM_API_HOST,
            platform_name: env.PLATFORM_NAME ?? "",
            // Same mechanism as WF6 (student chat) — platform_subject is shared
            // factual info (what this platform teaches). But the identity text is
            // DELIBERATELY a separate env var: this is the support/sales agent,
            // not the student tutor, so it gets its own dedicated instructions
            // (PLATFORM_SUPPORT_AI_INSTRUCTIONS) instead of reusing
            // PLATFORM_AI_INSTRUCTIONS, which is WF6's.
            platform_subject: env.PLATFORM_SUBJECT,
            ai_instructions: env.PLATFORM_SUPPORT_AI_INSTRUCTIONS ?? "",
            channel: "whatsapp",
          },
          {
            headers: {
              "X-Automation-Secret": env.AUTOMATION_SECRET,
              "Content-Type": "application/json",
            },
            // We don't need the reply here — WF13 sends it back asynchronously via
            // POST /internal/support/send-reply. But if the webhook only answers
            // when the whole run ends, a time limit would just log a failure for
            // a message n8n is handling fine — so wait for it, however long.
            timeout: 0,
            ...freshConnections,
          },
        ),
      [1_000, 3_000, 8_000, 20_000],
    );
  } catch (err) {
    logger.warn("[whatsapp-bridge] forward to n8n failed", {
      detail: axios.isAxiosError(err)
        ? { status: err.response?.status, code: err.code }
        : err instanceof Error
          ? err.message
          : String(err),
    });
  }
}

// ── Voice-note transcription ────────────────────────────────────────────────
// WhatsApp voice notes arrive as an audioMessage with no text. We download the
// audio bytes and send them to OpenAI speech-to-text so the support agent can
// treat a voice note exactly like a typed message. whisper-1 is used for its
// broad availability and solid Arabic support; language is hinted as Arabic.
// The call goes through the owner's metering proxy (billed to this platform's
// wallet); if the wallet is empty the proxy answers 402 and the voice note is
// ignored, exactly like any other AI feature on an out-of-credit platform.
const TRANSCRIBE_MODEL = "whisper-1";

async function transcribeVoiceMessage(msg: any): Promise<string> {
  const audio = msg?.message?.audioMessage;
  if (!audio) return ""; // not a voice/audio message
  if (!env.METERING_PROXY_URL) {
    logger.warn(
      "[whatsapp-bridge] voice note received but METERING_PROXY_URL is not set — ignoring",
    );
    return "";
  }
  try {
    const baileys = await loadEsm("baileys");
    baileysRuntime = baileys;
    const buffer: Buffer = await baileys.downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: makeSilentLogger(),
        reuploadRequest: sock?.updateMediaMessage?.bind(sock),
      },
    );
    if (!buffer || !buffer.length) return "";

    const form = new FormData();
    form.append("file", buffer, {
      filename: "voice.ogg",
      contentType: audio.mimetype || "audio/ogg",
    });
    form.append("model", TRANSCRIBE_MODEL);
    form.append("language", "ar");
    // verbose_json returns the audio duration, which is what Whisper is billed on.
    form.append("response_format", "verbose_json");

    const res = await axios.post(
      `${env.METERING_PROXY_URL.replace(/\/+$/, "")}/t/${encodeURIComponent(
        env.PLATFORM_TEACHER_ID,
      )}/openai/v1/audio/transcriptions`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${env.AUTOMATION_SECRET}`,
          "X-Meter-Feature": "whatsapp_voice",
        },
        timeout: 60_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );
    const text =
      res && res.data && res.data.text ? String(res.data.text).trim() : "";
    if (text) {
      logger.info("[whatsapp-bridge] transcribed voice note", { chars: text.length });
    }
    return text;
  } catch (err) {
    logger.warn("[whatsapp-bridge] voice transcription failed", {
      detail: axios.isAxiosError(err)
        ? { status: err.response?.status, code: err.code }
        : err instanceof Error
          ? err.message
          : String(err),
    });
    return "";
  }
}

// ── LID-aware reply routing ─────────────────────────────────────────────────
// Maps a contact (real phone, or a LID number) -> the exact jid they last
// messaged us from. Lets sendWhatsappText reply on the SAME address even when
// WhatsApp addressed the sender by a LID (`<id>@lid`), which never routes if you
// rebuild it as `<id>@s.whatsapp.net`.
const recentReplyJid = new Map<string, string>();
function rememberReplyJid(contact: string, jid: string): void {
  if (!contact || !jid) return;
  if (recentReplyJid.size > 2000) {
    const oldest = recentReplyJid.keys().next().value;
    if (oldest !== undefined) recentReplyJid.delete(oldest);
  }
  recentReplyJid.set(contact, jid);
  const normalized = toWhatsappNumber(contact);
  if (normalized && normalized !== contact) recentReplyJid.set(normalized, jid);
}

async function handleIncoming(payload: any): Promise<void> {
  // Only realtime pushes ("notify"); "append"/history syncs are ignored so we
  // never replay old chats through the agent after a reconnect.
  if (payload?.type !== "notify") return;
  // Teacher turned the AI agent off: ignore every inbound message. Checked before
  // any work (voice transcription is billed, first-contact is recorded) so a
  // paused agent costs nothing and a contact still gets their welcome later.
  if (!aiRepliesEnabled) {
    logger.info("[whatsapp-bridge] AI replies are off — inbound message ignored");
    return;
  }
  const messages: any[] = Array.isArray(payload.messages) ? payload.messages : [];
  for (const msg of messages) {
    try {
      if (!msg?.message || msg.key?.fromMe) continue;
      const jid: string = msg.key?.remoteJid ?? "";
      if (
        !jid ||
        jid.endsWith("@g.us") || // groups
        jid.endsWith("@newsletter") || // channels
        jid === "status@broadcast"
      ) {
        continue;
      }
      let text = extractText(msg.message);
      if (!text) {
        // No text content — if it's a voice note, transcribe it so the agent
        // can handle it like a typed message. Any other media is ignored.
        text = await transcribeVoiceMessage(msg);
      }
      if (!text) continue;
      // WhatsApp may address the sender by a LID (`<id>@lid`) instead of a real
      // phone number (common for Business accounts). `senderPn` carries the true
      // phone in that case; otherwise fall back to the jid's own number.
      const senderPn = String(msg.key?.senderPn ?? "");
      const from = (senderPn || jid).split("@")[0].split(":")[0];
      // Remember the EXACT jid we received on so the reply goes back there.
      rememberReplyJid(from, jid);
      logger.info("[whatsapp-bridge] inbound message", {
        from: env.NODE_ENV !== "production" ? from : "***",
        preview: text.slice(0, 60),
      });
      // Every message — including a contact's very first one — goes straight to
      // the agent, which just answers it. No intro/welcome is sent on first
      // contact, so the conversation reads like a normal reply, not a bot.
      await forwardToN8n({
        from,
        text,
        messageId: msg.key?.id ?? null,
      });
    } catch (err) {
      logger.warn("[whatsapp-bridge] failed to process an inbound message", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ── Socket lifecycle ───────────────────────────────────────────────────────────
async function connect(): Promise<void> {
  if (starting) return;
  starting = true;
  try {
    const baileys = await loadEsm("baileys");
    const makeWASocket = baileys.default ?? baileys.makeWASocket;
    const { DisconnectReason, makeCacheableSignalKeyStore } = baileys;

    const auth = await useMongoAuthState(baileys);
    const silentLogger = makeSilentLogger();

    // Ask WhatsApp for the current web version; fall back to Baileys' bundled
    // default if the lookup fails (offline / network hiccup).
    let version: unknown;
    try {
      const fetched = await baileys.fetchLatestBaileysVersion();
      version = fetched?.version;
    } catch {
      version = undefined;
    }

    const keys = makeCacheableSignalKeyStore
      ? makeCacheableSignalKeyStore(auth.state.keys, silentLogger)
      : auth.state.keys;

    state.status = state.status === "connected" ? "connecting" : state.status;

    sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: { creds: auth.state.creds, keys },
      logger: silentLogger,
      browser: [env.PLATFORM_NAME || "EduPlatform", "Chrome", "1.0.0"],
      markOnlineOnConnect: false, // keep the teacher's phone notifications intact
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      // A recipient can explicitly request a retry when its device cannot
      // decrypt one of our messages. Returning the original IMessage lets
      // Baileys create a fresh Signal session and relay that exact message.
      // The former `async () => undefined` made every such retry impossible.
      getMessage: async (key: any) => {
        const message = await getOutboundMessage(baileys, key?.id);
        if (!message && key?.id) {
          logger.warn("[whatsapp-bridge] retry requested for an unavailable message", {
            messageId: key.id,
          });
        }
        return message;
      },
    });

    sock.ev.on("creds.update", auth.saveCreds);

    sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrcodeMod: any = await loadEsm("qrcode");
          const toDataURL = qrcodeMod.toDataURL ?? qrcodeMod.default?.toDataURL;
          state.qrDataUrl = await toDataURL(qr, { margin: 1, width: 320 });
        } catch (err) {
          logger.warn("[whatsapp-bridge] failed to render QR image", {
            error: err instanceof Error ? err.message : String(err),
          });
          state.qrDataUrl = null;
        }
        state.status = "qr";
        logger.info(
          "[whatsapp-bridge] QR ready — open the admin panel (WhatsApp) to scan it",
        );
      }

      if (connection === "connecting") {
        if (state.status !== "qr") state.status = "connecting";
      }

      if (connection === "open") {
        state.status = "connected";
        state.qrDataUrl = null;
        state.lastError = null;
        state.since = new Date().toISOString();
        state.phone = (sock?.user?.id ?? "").split(":")[0].split("@")[0] || null;
        logger.info("[whatsapp-bridge] connected", {
          phone: env.NODE_ENV !== "production" ? state.phone : "***",
        });
      }

      if (connection === "close") {
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ??
          lastDisconnect?.error?.output?.payload?.statusCode;
        const loggedOut = statusCode === DisconnectReason?.loggedOut;

        if (loggedOut) {
          // The phone unlinked this device. The stored creds are now useless —
          // wipe them so the next start produces a fresh QR instead of looping.
          state.status = "logged_out";
          state.phone = null;
          state.qrDataUrl = null;
          try {
            await auth.clearAll();
          } catch {
            /* best effort */
          }
          logger.warn(
            "[whatsapp-bridge] logged out (phone unlinked) — scan a new QR from the admin panel to relink",
          );
        } else {
          state.status = "disconnected";
          logger.warn("[whatsapp-bridge] connection closed — reconnecting shortly", {
            statusCode,
          });
          scheduleReconnect();
        }
      }
    });

    sock.ev.on("messages.upsert", (payload: any) => {
      void handleIncoming(payload);
    });
  } catch (err) {
    state.status = "error";
    state.lastError = err instanceof Error ? err.message : String(err);
    logger.error("[whatsapp-bridge] failed to start socket", {
      error: state.lastError,
    });
    scheduleReconnect();
  } finally {
    starting = false;
  }
}

function scheduleReconnect(delayMs = 4000): void {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delayMs);
  reconnectTimer.unref?.();
}

// ── Public API (the only surface the rest of the app uses) ─────────────────────

/**
 * Starts the WhatsApp bridge. Fire-and-forget from server bootstrap — never
 * throws, so a WhatsApp problem can never stop the API from serving. When
 * WHATSAPP_BRIDGE_ENABLED is false the bridge stays dormant and every send
 * becomes a logged no-op (handy for CI / non-WhatsApp environments).
 */
export async function initWhatsappBridge(): Promise<void> {
  await loadAiRepliesSetting();

  if (!env.WHATSAPP_BRIDGE_ENABLED) {
    state.status = "disabled";
    logger.info("[whatsapp-bridge] disabled via WHATSAPP_BRIDGE_ENABLED=false");
    return;
  }

  // The retry-message TTL index is essential in production too, where the
  // general Mongoose autoIndex setting is intentionally off.
  try {
    await ensureWhatsappOutboundMessageIndexes();
  } catch (err) {
    // Keep the bridge available if Mongo is temporarily unavailable; outgoing
    // messages still have the in-memory retry cache for this process.
    logger.error("[whatsapp-bridge] could not ensure outbound-message TTL index", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  stopped = false;
  state.status = "init";
  await connect();
}

/** Closes the socket on graceful shutdown. Best-effort; never throws. */
export async function shutdownWhatsappBridge(): Promise<void> {
  stopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    sock?.end?.(undefined);
  } catch {
    /* ignore */
  }
  sock = null;
}

/** True when the socket is linked and can send/receive right now. */
export function isWhatsappReady(): boolean {
  return state.status === "connected" && !!sock;
}

/** True when the AI agent may answer incoming messages (the teacher's switch). */
export function isAiRepliesEnabled(): boolean {
  return aiRepliesEnabled;
}

/** Turns the AI agent's replies on/off and persists the choice. */
export async function setAiRepliesEnabled(enabled: boolean): Promise<void> {
  await WhatsappSettings.updateOne(
    { _id: WHATSAPP_SETTINGS_ID },
    { $set: { aiRepliesEnabled: enabled } },
    { upsert: true },
  );
  aiRepliesEnabled = enabled;
  logger.info(`[whatsapp-bridge] AI replies ${enabled ? "enabled" : "disabled"}`);
}

/** Snapshot for the admin panel status widget. */
export function getBridgeStatus(): {
  status: BridgeStatus;
  phone: string | null;
  since: string | null;
  lastError: string | null;
  aiRepliesEnabled: boolean;
} {
  return {
    status: state.status,
    phone: state.phone,
    since: state.since,
    lastError: state.lastError,
    aiRepliesEnabled,
  };
}

/** The current QR (PNG data: URL) for the admin panel to render, if waiting. */
export function getBridgeQr(): { status: BridgeStatus; qr: string | null } {
  return { status: state.status, qr: state.status === "qr" ? state.qrDataUrl : null };
}

/**
 * Unlinks the current session and wipes stored creds, then restarts so a fresh
 * QR is produced. Used by the admin "relink number" action.
 */
export async function logoutBridge(): Promise<void> {
  try {
    await sock?.logout?.();
  } catch {
    /* the socket may already be dead; fall through to wiping creds */
  }
  try {
    await WhatsappSession.deleteMany({});
  } catch {
    /* best effort */
  }
  state.phone = null;
  state.qrDataUrl = null;
  await shutdownWhatsappBridge();
  await initWhatsappBridge();
}

/** Restarts the socket without wiping creds (e.g. to recover a stuck session). */
export async function restartBridge(): Promise<void> {
  await shutdownWhatsappBridge();
  await initWhatsappBridge();
}

/**
 * Normalizes an Egyptian mobile number to a WhatsApp JID number: digits only,
 * with the 20 country code, no leading "+"/"00".
 *   01012345678   -> 201012345678
 *   +201012345678 -> 201012345678
 * Returns null when the input clearly is not a usable number.
 */
export function toWhatsappNumber(rawPhone: string): string | null {
  const digits = (rawPhone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `20${digits}`;
  return digits;
}

export interface SendResult {
  sent: boolean;
  ready: boolean; // whether the bridge was connected when we tried
  messageId: string | null;
  reason: string;
}

/**
 * Sends a plain-text WhatsApp message from the platform's linked number. This is
 * the ONE place the whole app talks to WhatsApp — the parent digest, the support
 * agent's replies, and teacher escalation pings all funnel through here.
 *
 * Never throws: a messaging failure must not break the caller's request/loop.
 * When the bridge is not connected yet it logs the message and reports
 * sent:false (so the pipeline is fully testable before a number is linked).
 */
export async function sendWhatsappText(
  rawPhone: string,
  text: string,
): Promise<SendResult> {
  const number = toWhatsappNumber(rawPhone);
  if (!number) {
    return { sent: false, ready: isWhatsappReady(), messageId: null, reason: "INVALID_PHONE" };
  }

  if (!isWhatsappReady()) {
    logger.info("[whatsapp-bridge] (not connected) message not sent", {
      to: env.NODE_ENV !== "production" ? number : "***",
      status: state.status,
      preview: text.slice(0, 80),
    });
    return { sent: false, ready: false, messageId: null, reason: `NOT_CONNECTED_${state.status}` };
  }

  // Prefer the exact jid the contact last messaged us on (handles LID senders);
  // fall back to the standard phone jid for fresh outbound (e.g. parent digest).
  const jid =
    recentReplyJid.get(rawPhone) ?? recentReplyJid.get(number) ?? `${number}@s.whatsapp.net`;
  try {
    const res = await sock.sendMessage(jid, { text });
    const messageId: string | null = res?.key?.id ? String(res.key.id) : null;
    const message = res?.message;
    if (messageId && message) {
      cacheOutboundMessage(messageId, message);
      try {
        const baileys = baileysRuntime ?? (await loadEsm("baileys"));
        await persistOutboundMessage(baileys, messageId, message);
      } catch (err) {
        // The message was accepted by WhatsApp, so do not report it as a send
        // failure. It remains retryable from memory until this process exits;
        // this log tells us that a deploy/restart would lose that fallback.
        logger.error("[whatsapp-bridge] sent message was not persisted for retry", {
          messageId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { sent: true, ready: true, messageId, reason: "SENT" };
  } catch (err) {
    logger.error("[whatsapp-bridge] send failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, ready: true, messageId: null, reason: "SEND_FAILED" };
  }
}
