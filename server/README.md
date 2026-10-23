# Mr. Kamal Ashraf — Backend API

Express + MongoDB + TypeScript backend for the platform. One deployment serves **one teacher** (`PLATFORM_TEACHER_ID`).

> Full project documentation (architecture, env tables, API reference): [root README](../README.md).
> The n8n AI layer and multi-tenancy: [AI_SYSTEM_GUIDE.md](../AI_SYSTEM_GUIDE.md).

---

## Stack

Node 20+ · TypeScript 5 · Express 4 · Mongoose 8 · Zod · JWT in HttpOnly cookies · bcryptjs · Helmet / hpp / mongo-sanitize / express-rate-limit · Winston + Morgan · Multer 2 · Baileys (WhatsApp) · Axios (n8n, Paymob, Bunny).

---

## Setup

```bash
cp .env.example .env     # see the root README for the variable groups
npm install
npm run dev
```

On first start the single admin is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`.

| Script | What it does |
|---|---|
| `npm run dev` | Hot reload (`tsx watch`) |
| `npm run build` / `npm start` | Compile to `dist/` / run the build |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run admin:update` | Reset the admin password from `.env` |

Startup (`src/server.ts`): connect DB → seed admin → listen → fire-and-forget `callRegisterPlatform()` (tells n8n's WF11 this backend's host) and `initWhatsappBridge()` (Baileys). Neither can block or fail startup.

---

## Structure

```
src/
├── config/            env (Zod-validated), database, constants (stages, enrollment/payment enums)
├── shared/            middlewares (auth, validate, rate limits, upload, automation secret), utils
├── routes/            index.ts (public/student/ai/internal), admin.routes.ts (admin-only)
├── seeds/             seedAdmin (boot), seedDemoCourses / cleanupDemoCourses (manual)
└── modules/
    ├── auth, sessions          student auth, device sessions
    ├── admin-auth, admins      admin auth, dashboard stats
    ├── users                   admin-side student management
    ├── courses, lessons        CRUD, publish, thumbnails, video upload
    ├── enrollments             course ownership (access source of truth)
    ├── payments                Paymob checkout + HMAC webhook
    ├── progress                heartbeats, completion, monthly commitment
    ├── sales                   sales report / summary / CSV
    ├── bunny, cloudinary       Stream + Storage, thumbnails
    ├── ai                      proxy to n8n (student chat, curriculum, exam generator)
    ├── internal                endpoints n8n calls (stats, parent digest, support tools)
    ├── whatsapp-bridge         Baileys session, inbound → n8n, QR/status admin API
    ├── notifications           fixed-text WhatsApp senders (digest, welcome)
    ├── support                 escalation inbox
    └── audit-logs
```

`scripts/update-admin.js` is the only standalone CLI utility. `_to_delete/` holds old diagnostics.

---

## API mounts

| Mount | Auth | Description |
|---|---|---|
| `/auth`, `/courses`, `/lessons`, `/progress`, `/payments` | student cookie (some public) | student site |
| `/ai/student-chat` | student + owns ≥ 1 course | AI tutor |
| `/ai/*` (curriculum, exam-generator, exams) | admin cookie | AI tools |
| `/admin/auth` | — | admin login |
| `/admin/*` | admin cookie | dashboard, students, courses, lessons, sales, escalations, whatsapp, audit-logs |
| `/internal/*` | `X-Automation-Secret` | n8n → backend only |
| `/health` | — | uptime |

Endpoint-by-endpoint list: [root README → API reference](../README.md#api-reference).

---

## Notes

- **Access = course ownership** (`Enrollment.status === "active"`), not subscriptions. Free courses are granted instantly.
- **Single-tenant backend:** every `/internal/*` handler returns empty / no-op for a `teacher_id` other than `PLATFORM_TEACHER_ID`.
- **`AUTOMATION_SECRET`** is this platform's own secret issued by n8n's WF15 and also checked by n8n against its `platforms` registry. Rotating it means updating the registry row, not editing workflows.
- WhatsApp messages (parent digest, welcome, support replies, escalation pings) all leave through the in-process Baileys session; link the number from the admin **WhatsApp** page. With `WHATSAPP_BRIDGE_ENABLED=false` sends are logged no-ops.
- Parent digest wording is a fixed Arabic template in `modules/notifications/whatsapp.client.ts` — never AI-generated.
- Scheduling lives in n8n (WF7, weekly), not here; `node-cron` is installed but unused.
- Lesson thumbnails are stored on Cloudinary; legacy `/uploads/` paths are still resolved. Videos go straight to Bunny Stream — only `bunnyVideoId` is stored.
