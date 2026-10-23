import { Schema, model } from "mongoose";

/**
 * Persistent store for the Baileys WhatsApp session (auth credentials + Signal
 * protocol keys).
 *
 * ── Why MongoDB and not the default file store ───────────────────────────────
 * Baileys ships `useMultiFileAuthState`, which writes the session to a folder on
 * disk. On most hosting providers (Railway, Render, Fly, …) the filesystem is
 * EPHEMERAL — every redeploy/restart wipes it, which would log the number out
 * and force a fresh QR scan on every `git push`. Storing the session in the same
 * MongoDB this backend already uses makes it survive redeploys: push code, the
 * process restarts, and the WhatsApp session resumes silently.
 *
 * Each document is one Baileys auth entry:
 *   _id  = a stable string key ("creds", "session-<jid>", "pre-key-<n>", …)
 *   data = the BufferJSON-serialized value (Buffers stored as base64 markers)
 *
 * The `_id` is a plain string (not the default ObjectId) so Baileys can address
 * entries by its own key names.
 *
 * NOTE (multi-tenant future): today this holds ONE session (one support number
 * per backend deployment). When several numbers must live in one process, add a
 * `tenant` field and make the compound key `{ tenant, key }`.
 */
export interface IWhatsappSession {
  _id: string;
  data: unknown;
}

const whatsappSessionSchema = new Schema<IWhatsappSession>(
  {
    _id: { type: String, required: true },
    // Mixed: an opaque Baileys blob. minimize:false keeps empty objects intact
    // (some Signal key entries legitimately serialize to `{}`).
    data: { type: Schema.Types.Mixed },
  },
  { versionKey: false, minimize: false, timestamps: false },
);

export const WhatsappSession = model<IWhatsappSession>(
  "WhatsappSession",
  whatsappSessionSchema,
  "whatsapp_sessions",
);

/**
 * The original plaintext payload for a recently sent message. Baileys needs it
 * when a recipient asks for a Signal-protocol retry; without it, WhatsApp can
 * leave the recipient on "Waiting for this message" indefinitely.
 *
 * This is deliberately separate from auth keys. It has a TTL so retry support
 * survives a restart/redeploy without turning the application's database into
 * an unbounded chat archive.
 */
export interface IWhatsappOutboundMessage {
  _id: string;
  data: unknown;
  expiresAt: Date;
  /** Times a recipient device asked for it again because it couldn't decrypt it. */
  retries?: number;
  /** Furthest WhatsApp status reached (2 sent · 3 delivered · 4 read · 5 played). */
  status?: number;
}

const whatsappOutboundMessageSchema = new Schema<IWhatsappOutboundMessage>(
  {
    _id: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    // Delivery trail — tells a message that reached the phone apart from one
    // stuck on "Waiting for this message" (retries keep climbing, no delivery).
    retries: { type: Number, default: 0 },
    status: { type: Number, default: 0 },
    // A TTL index with expireAfterSeconds: 0 expires each row at this exact
    // timestamp. MongoDB's TTL monitor is asynchronous, which is fine: rows
    // may remain briefly past expiry but will never be deleted too early.
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, minimize: false, timestamps: false },
);

export const WhatsappOutboundMessage = model<IWhatsappOutboundMessage>(
  "WhatsappOutboundMessage",
  whatsappOutboundMessageSchema,
  "whatsapp_outbound_messages",
);

/**
 * Production disables Mongoose autoIndex at startup, so create the TTL index
 * explicitly when the bridge starts. createIndex is idempotent when the index
 * already exists and keeps the retry store bounded after deployments as well.
 */
export async function ensureWhatsappOutboundMessageIndexes(): Promise<void> {
  await WhatsappOutboundMessage.collection.createIndex(
    { expiresAt: 1 },
    { name: "expiresAt_1", expireAfterSeconds: 0 },
  );
}

/**
 * Teacher-controlled WhatsApp settings. A single document (`_id: "main"`) — one
 * linked number per backend deployment, like the session store above.
 *
 *   aiRepliesEnabled = master switch for the AI support agent. When false the
 *                      linked number still sends parent reports / lesson alerts,
 *                      but incoming messages are ignored and get NO AI reply.
 *
 * Persisted (not env/in-memory) so the teacher's choice survives restarts and
 * redeploys.
 */
export interface IWhatsappSettings {
  _id: string;
  aiRepliesEnabled: boolean;
}

const whatsappSettingsSchema = new Schema<IWhatsappSettings>(
  {
    _id: { type: String, required: true },
    aiRepliesEnabled: { type: Boolean, default: true },
  },
  { versionKey: false, timestamps: false },
);

export const WhatsappSettings = model<IWhatsappSettings>(
  "WhatsappSettings",
  whatsappSettingsSchema,
  "whatsapp_settings",
);

export const WHATSAPP_SETTINGS_ID = "main";

/**
 * Remembers which WhatsApp contacts already received the first-contact welcome
 * message, so the greeting is sent exactly once per person (not on every
 * message, and not again after a process restart).
 *
 *   _id      = the contact's phone/identifier as the bridge forwards it
 *   greetedAt = when the welcome was sent
 */
export interface IWhatsappContact {
  _id: string;
  greetedAt: Date;
}

const whatsappContactSchema = new Schema<IWhatsappContact>(
  {
    _id: { type: String, required: true },
    greetedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, timestamps: false },
);

export const WhatsappContact = model<IWhatsappContact>(
  "WhatsappContact",
  whatsappContactSchema,
  "whatsapp_contacts",
);
