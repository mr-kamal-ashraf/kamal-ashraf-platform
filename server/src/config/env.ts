import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load .env from the project root (server/) before schema validation.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/**
 * A CDN hostname however it was pasted — "https://x.b-cdn.net/" → "x.b-cdn.net".
 * The code builds links as `https://${host}/…`, so a value copied with its
 * scheme used to produce "https://https//…" and a silent black video player.
 */
const cdnHost = z
  .string()
  .optional()
  .transform((v) => v?.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "") || undefined);

/**
 * Zod schema for all environment variables.
 * The app calls process.exit(1) at startup if any required variable is
 * missing or fails validation — fail fast, fail loud.
 */
const envSchema = z.object({
  // ── Core ─────────────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default("/api/v1"),

  CLIENT_URL: z.string().url().default("http://localhost:3000"),

  // ── Database ────────────────────────────────────────────────────────────
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // ── JWT & cookies ────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"), // short-lived; rotated via refresh
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"), // stored in HttpOnly cookie

  COOKIE_DOMAIN: z.string().default("localhost"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // ── Seed admin account ──────────────────────────────────────────────────────
  // Used by seedAdmin.ts to create the initial admin user on first run.
  ADMIN_EMAIL: z.string().email("ADMIN_EMAIL must be a valid email"),
  ADMIN_PASSWORD: z
    .string()
    .min(8, "ADMIN_PASSWORD must be at least 8 characters"),
  ADMIN_NAME: z.string().min(1, "ADMIN_NAME is required"),

  // ── Bunny.net Stream ──────────────────────────────────────────────────────
  // All four are optional; if any is missing isBunnyConfigured() returns false
  // and video upload/playback routes will throw a 500 gracefully.
  BUNNY_API_KEY: z.string().optional(),
  BUNNY_LIBRARY_ID: z.string().optional(),
  BUNNY_PULL_ZONE: cdnHost,
  BUNNY_TOKEN_AUTH_KEY: z.string().optional(),
  BUNNY_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(14400),
  // When true, use the older SHA256(key+path+expires+ip) playback token. When false
  // (default), use Bunny CDN advanced directory signing (HS256 + token_path) so HLS
  // segments and thumbnails under the same video folder are authorized together.
  BUNNY_PLAYBACK_TOKEN_LEGACY: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Whether to bind the playback token to the viewer's IP address.
  //
  // Bunny folds the IP into the token signature, so the token only validates when
  // the IP THIS server sees (via the reverse proxy / X-Forwarded-For) is exactly
  // the IP Bunny's CDN sees when the browser fetches the video. In practice those
  // routinely differ — client reaching us over IPv6 but Bunny over IPv4 (or vice
  // versa), CGNAT on mobile networks, a VPN toggled mid-session — and every
  // mismatch is a hard 403 that surfaces to the student as a silent black player.
  //
  // Left OFF by default because the protection it adds is small next to that
  // failure rate: links are already short-lived (BUNNY_SIGNED_URL_TTL_SECONDS)
  // and scoped to one video's folder. Only turn it on if you've confirmed the
  // IPs match in your specific deployment.
  BUNNY_TOKEN_BIND_IP: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // ── Bunny.net Storage (curriculum PDF originals) ───────────────────────────────
  // Separate product from Bunny Stream above. Used ONLY to keep a persistent
  // copy of the original curriculum PDF so the admin panel's "فتح الرابط
  // الأصلي" feature keeps working. The AI/vector indexing does NOT go through
  // this URL — the backend streams the PDF binary straight to n8n's webhook.
  // If any of the three below is missing, isBunnyStorageConfigured() is false
  // and the curriculum upload route throws a friendly configuration error.
  BUNNY_STORAGE_ZONE_NAME: z.string().optional(),
  BUNNY_STORAGE_ACCESS_KEY: z.string().optional(),
  BUNNY_STORAGE_PULL_ZONE: cdnHost.describe("Bunny CDN hostname for the storage zone, e.g. kamal-ashraf-files.b-cdn.net"),
  BUNNY_CURRICULUM_FOLDER: z
    .string()
    .default("curriculum-pdfs")
    .describe("Folder path inside the storage zone for teacher-uploaded curriculum PDFs"),

  // ── Cloudinary (lesson thumbnails only; video stays on Bunny Stream) ───────────
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_THUMBNAIL_FOLDER: z
    .string()
    .default("kamal-ashraf/lesson-thumbnails")
    .describe("Folder path in Cloudinary for lesson thumbnail images"),
  CLOUDINARY_CURRICULUM_FOLDER: z
    .string()
    .default("kamal-ashraf/curriculum-pdfs")
    .describe("Folder path in Cloudinary for teacher-uploaded curriculum PDFs"),

  // ── Security & business rules ──────────────────────────────────────────────────
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12), // cost factor for password hashing
  MAX_DEVICES_PER_USER: z.coerce.number().int().positive().default(2), // max concurrent sessions
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(10), // attempts before account lock
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(60), // lock duration in minutes
  SUBSCRIPTION_WARNING_DAYS: z.coerce.number().int().positive().default(7), // warn student this many days before expiry
  LESSON_COMPLETION_THRESHOLD: z.coerce
    .number()
    .int()
    .min(50)
    .max(100)
    .default(90), // % watched to mark lesson complete

  // ── Rate limiting ────────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 min window
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100), // max requests per window

  DNS_SERVERS: z.string().optional(), // comma-separated custom DNS servers (optional)

  // ── AI / n8n integration ─────────────────────────────────────────────────────
  // Base URL of the n8n instance's webhook endpoints. Example: https://mohamedhany12312.app.n8n.cloud/webhook
  // Every AI route on this server forwards to this base + a fixed path (e.g. /student-chat).
  N8N_WEBHOOK_BASE_URL: z
    .string()
    .url()
    .default("https://n8n-production-4b10.up.railway.app/webhook"),
  // This platform's OWN per-platform secret, sent to n8n in the X-Automation-Secret
  // header AND expected on all /api/v1/internal/* routes coming FROM n8n. n8n matches
  // it against this platform's row in the shared `platforms` collection. Rotate by
  // changing this env and that row together.
  AUTOMATION_SECRET: z
    .string()
    .min(24, "AUTOMATION_SECRET must be at least 24 characters"),
  // This platform is single-tenant right now (one teacher = Mr. Kamal Ashraf). Every AI call
  // and every internal query uses this constant as the teacher_id passed to n8n. When the
  // platform becomes multi-tenant, this becomes per-user (derived from a User.teacherId field).
  PLATFORM_TEACHER_ID: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]{1,64}$/,
      "PLATFORM_TEACHER_ID must be 1-64 chars of [a-zA-Z0-9_-]",
    )
    .default("t_kamal_ashraf"),
  // The subject this whole platform teaches — set ONCE per teacher's deployment
  // (this teacher = Biology & Geology; another teacher's deployment = Chemistry, etc.).
  // Sent with every curriculum upload so the AI knows the subject without the
  // teacher having to re-type it on every book. When multi-tenant lands this
  // moves to a per-tenant field on the teacher record.
  PLATFORM_SUBJECT: z
    .string()
    .trim()
    .min(1, "PLATFORM_SUBJECT is required")
    .max(120)
    .default("أحياء وجيولوجيا"),
  // This backend's OWN publicly reachable base URL (no trailing slash), e.g.
  // https://api.myplatform.com. n8n needs this to call BACK into this backend
  // (WF5 platform stats, WF10 student self-stats) instead of a hardcoded host,
  // so the same n8n instance can serve multiple separate teacher deployments.
  // In local dev this must still be a URL n8n Cloud can actually reach (a
  // tunnel like ngrok) for the stats tools to work — plain localhost will not
  // work since n8n runs in the cloud, not on this machine.
  PLATFORM_API_HOST: z
    .string()
    .url("PLATFORM_API_HOST must be a valid URL, e.g. https://api.myplatform.com")
    .transform((v) => v.replace(/\/+$/, ""))
    .default("http://localhost:5000"),
  // Human-readable label for this teacher's platform, sent to n8n's WF11
  // (Register Platform) purely for display/debugging in the shared `platforms`
  // collection — never used for auth or routing. Optional; left blank is fine.
  PLATFORM_NAME: z.string().trim().optional(),

  // REQUIRED. The platform's own definition of WHO the student AI assistant is
  // and what its mission is here — e.g. "أنت مساعد منصة مستر أحمد لمادة الكيمياء،
  // مهمتك تساعد الطلبة يفهموا ...". Sent with every student-chat call and injected
  // at the TOP of the agent's system prompt as its identity. It NEVER overrides
  // the platform's fixed safety/behaviour rules (no solving homework,
  // curriculum-only, child-safe tone) — those always win. Every platform MUST
  // set this so the assistant knows which platform it belongs to.
  PLATFORM_AI_INSTRUCTIONS: z
    .string()
    .trim()
    .min(
      1,
      "PLATFORM_AI_INSTRUCTIONS is required — define who the AI assistant is on this platform (identity + mission). See .env.example.",
    )
    .max(2000),

  // OPTIONAL. Same idea as PLATFORM_AI_INSTRUCTIONS above, but for the OTHER
  // AI on this platform: WF13, the WhatsApp support/sales agent that talks to
  // customers and parents (courses, prices, payments, escalations) — a
  // different job from the student tutor, so it gets its own identity text
  // instead of reusing PLATFORM_AI_INSTRUCTIONS. Sent with every inbound
  // WhatsApp message and injected at the TOP of that agent's system prompt,
  // same as the student one. Also never overrides the fixed support-agent
  // rules (privacy, no promises, escalation) — those always win. If left
  // blank, WF13 just falls back to its generic built-in support persona.
  PLATFORM_SUPPORT_AI_INSTRUCTIONS: z.string().trim().max(2000).optional(),

  // ── Paymob payment gateway ─────────────────────────────────────────────────
  // Classic Paymob Accept flow (auth token -> order -> payment key -> pay).
  // All optional. API key + HMAC secret are needed for any method; then each
  // method switches on when its own integration id is set (see
  // availablePaymentMethods()): card = INTEGRATION_ID + IFRAME_ID, mobile
  // wallets (Vodafone Cash, Etisalat Cash, Orange Cash, WE Pay…) =
  // WALLET_INTEGRATION_ID. A method that isn't configured is simply not offered. Each teacher's
  // deployment supplies its OWN Paymob credentials.
  //
  // Card fields embedded in our own checkout (Paymob Pixel): set the account's
  // SECRET_KEY + PUBLIC_KEY (dashboard → Settings → Account Info) next to
  // INTEGRATION_ID, and the card form opens inside the course page instead of
  // redirecting to Paymob's iframe page (IFRAME_ID is then not needed). The
  // card details are typed into Paymob's secure frame — they never reach us.
  PAYMOB_API_KEY: z.string().optional(),           // account API key (secret)
  PAYMOB_SECRET_KEY: z.string().optional(),        // account secret key (egy_sk_…), server only
  PAYMOB_PUBLIC_KEY: z.string().optional(),        // account public key (egy_pk_…), sent to the browser
  PAYMOB_INTEGRATION_ID: z.string().optional(),    // the card payment integration id
  PAYMOB_IFRAME_ID: z.string().optional(),         // the iframe id used to render checkout
  PAYMOB_WALLET_INTEGRATION_ID: z.string().optional(), // mobile wallets integration id
  PAYMOB_HMAC_SECRET: z.string().optional(),       // HMAC secret used to verify callbacks
  PAYMOB_BASE_URL: z
    .string()
    .url()
    .default("https://accept.paymob.com/api")
    .transform((v) => v.replace(/\/+$/, "")),

  // ── WhatsApp (self-hosted Baileys bridge) ───────────────────────────────────
  // WhatsApp messages (weekly parent digest, support-agent replies, teacher
  // escalation pings) are sent through an in-process Baileys session — the
  // platform's own number is linked once by scanning a QR from the admin panel,
  // and the session is persisted in MongoDB so it survives redeploys. There are
  // no Meta credentials to configure.
  //
  // Set to "false" to keep the bridge dormant (e.g. CI / non-WhatsApp
  // environments): the socket never connects and every send becomes a logged
  // no-op, so the whole pipeline stays testable without a linked number.
  WHATSAPP_BRIDGE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Teacher's own WhatsApp number (EG format, e.g. 201001234567 or 01001234567).
  // The support agent pings this number when it escalates a case. Optional: when
  // unset, escalations are still saved to the admin panel, just not pushed to
  // WhatsApp.
  TEACHER_SUPPORT_PHONE: z.string().optional(),
  // Base URL of the owner's metering proxy for OpenAI, e.g.
  //   https://<dashboard>/api/metering
  // The WhatsApp bridge sends voice notes for speech-to-text through it, so the
  // cost is debited from THIS platform's AI wallet (authenticated with
  // AUTOMATION_SECRET). The platform never holds an OpenAI key.
  // Optional: when unset, voice notes are simply ignored (text still works).
  METERING_PROXY_URL: z
    .string()
    .trim()
    .url("METERING_PROXY_URL must be a valid URL")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

// Validate process.env against the schema.
// If validation fails, print the offending fields and exit immediately.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Export the validated + type-safe env object used throughout the app.
export const env = parsed.data;
export type Env = typeof env;
