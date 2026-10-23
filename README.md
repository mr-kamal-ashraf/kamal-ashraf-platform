<div align="center">

# Mr. Kamal Ashraf — Educational Platform

A course-selling video platform for an individual teacher (Next.js + Express + MongoDB), with an optional AI layer (student tutor, exam generator, WhatsApp support agent, parent progress reports) that runs on a shared **n8n** instance.

</div>

---

## نظرة عامة (Arabic Summary)

منصة تعليمية لأستاذ منفرد (الأستاذ كمال أشرف – أحياء وجيولوجيا للإعدادية والثانوية)، وفيها:

- **بيع الكورسات**: الطالب يشتري كل كورس لوحده أونلاين (Paymob) أو الأستاذ يفتحه له كاش من لوحة التحكم. مفيش اشتراكات شهرية.
- **فيديو آمن** عن طريق Bunny Stream بروابط موقعة ومحدودة الوقت، وتتبّع مشاهدة لكل درس (الدرس بيتحسب مكتمل عند 90٪).
- **لوحة أدمن كاملة بالعربي**: داشبورد، طلاب، كورسات، دروس، مبيعات (مع تصدير CSV)، سجل إجراءات، تصعيدات الدعم، وربط واتساب.
- **طبقة AI على n8n**: مساعد للطالب من منهج المدرس بس، مولّد امتحانات من الكتب المرفوعة، وكيل دعم على واتساب، وتقرير أسبوعي لأولياء الأمور.
- **المنصة بتتكرر لكل مدرس**: كل مدرس ليه deployment خاص بيه (باك + فرونت + قاعدة بيانات + حساب Paymob + رقم واتساب)، وكلهم بيستخدموا **نفس n8n** (multi-tenant) — التفاصيل في [`AI_SYSTEM_GUIDE.md`](./AI_SYSTEM_GUIDE.md).

---

## Table of Contents

- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [How the system fits together](#how-the-system-fits-together)
- [Features](#features)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Data models](#data-models)
- [API reference](#api-reference)
- [Access rules](#access-rules)
- [External services](#external-services)
- [Security](#security)
- [Standing a new teacher up](#standing-a-new-teacher-up)
- [Known loose ends](#known-loose-ends)

---

## Repository layout

```
mr.amr-zaher-platform/
├── client/                      # Next.js 15 (App Router) + React 19 + Tailwind v4
│   ├── app/                     # Routes only (thin pages that render a feature view)
│   │   ├── page.tsx             #   landing
│   │   ├── courses/, lessons/, player/, profile/, login/, register/, payment/callback/
│   │   └── admin/               #   login + (panel)/ → dashboard, students, courses,
│   │                            #   lessons, sales, ai/{curriculum,exam-generator},
│   │                            #   escalations, whatsapp, audit-logs
│   └── src/
│       ├── api/                 # API client + typed wrappers (student side and admin/)
│       ├── features/            # UI grouped by feature: admin/, ai-chat/, auth/, courses/,
│       │                        #   home/, lessons/, payments/, player/, profile/
│       ├── shared/              # components, ui, hooks, lib, i18n
│       └── config/env.ts        # API_URL (NEXT_PUBLIC_API_URL)
├── server/                      # Express + MongoDB + TypeScript — REST API at /api/v1
│   ├── src/
│   │   ├── config/              # env (Zod-validated), database, constants
│   │   ├── modules/             # one folder per feature (see below)
│   │   ├── shared/              # middlewares, utils, types
│   │   ├── routes/              # index.ts (public/student/ai/internal) + admin.routes.ts
│   │   ├── seeds/               # seedAdmin (runs on boot), demo-course seed/cleanup
│   │   ├── app.ts / server.ts
│   ├── scripts/update-admin.js  # reset the admin password from .env
│   └── _to_delete/              # old diagnostic scripts, safe to remove
├── AI_SYSTEM_GUIDE.md           # the n8n AI layer + multi-tenancy (read this for anything AI)
└── Claude outputs/              # stray snippet (append-to-internal-service.ts), safe to remove
```

Server modules (`server/src/modules/`):

| Module | Responsibility |
|---|---|
| `auth`, `sessions` | Student register/login/refresh/logout, device sessions (max 2) |
| `admin-auth`, `admins` | Admin login (separate cookies), dashboard stats |
| `users` | Admin-side student management |
| `courses`, `lessons` | Course/lesson CRUD, publish, thumbnails, Bunny video upload |
| `enrollments` | Course ownership (the single source of truth for access) |
| `payments` | Paymob checkout + HMAC-verified webhook |
| `progress` | Watch heartbeats, completion, monthly **commitment** score |
| `sales` | Sales report (online + cash), summary, CSV export |
| `bunny`, `cloudinary` | Video (Stream), curriculum PDFs (Storage), thumbnails |
| `ai` | Proxy to n8n: student chat, curriculum upload/list/delete, exam generator + saved exams |
| `internal` | Endpoints **n8n calls** (stats, parent digest, WhatsApp support tools) |
| `whatsapp-bridge`, `notifications` | In-process Baileys WhatsApp session + fixed-text senders |
| `support` | Escalation inbox (cases the WhatsApp agent hands to the teacher) |
| `audit-logs` | Admin action trail |

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, Framer Motion, Swiper, hls.js + Plyr, sonner |
| Backend | Node 20+, Express 4, Mongoose 8, Zod, JWT (HttpOnly cookies), bcryptjs, Helmet, hpp, mongo-sanitize, express-rate-limit, Winston |
| Video | Bunny Stream (signed playback URLs) |
| Files | Bunny Storage (curriculum PDFs), Cloudinary (thumbnails) |
| Payments | Paymob Accept (card iframe) |
| WhatsApp | Baileys (self-hosted, session persisted in MongoDB) — no Meta credentials |
| AI | n8n (shared instance) + OpenAI + MongoDB Atlas Vector Search |

---

## How the system fits together

```
 Student/Admin browser ──► Next.js client ──► Express API (this repo, one per teacher)
                                                  │   ▲
                       user-triggered AI          │   │  server-to-server tools
                       (X-Automation-Secret)      ▼   │  (X-Automation-Secret)
                                              n8n (SHARED by all teachers)
                                                  │
                          OpenAI · Atlas vector index · shared `platforms` registry
```

- **The platform works with no AI at all.** n8n is an add-on layer.
- **One deployment per teacher.** The backend is single-tenant: `PLATFORM_TEACHER_ID` identifies it, and every `/internal/*` endpoint ignores requests for any other `teacher_id`.
- **n8n is the multi-tenant part.** It looks each caller up in a shared `platforms` collection (`teacherId`, `platformApiHost`, per-platform `automationSecret`, `aiCreditsRemaining`) and calls back into that teacher's own backend.
- The browser never talks to n8n. `ai.service.ts` adds the secret server-side and derives `student_id` / `teacher_id` from the session, not from the request body.

Everything about the AI side (workflows, flows, onboarding, credits) is in **[`AI_SYSTEM_GUIDE.md`](./AI_SYSTEM_GUIDE.md)**.

---

## Features

### Student site
- Register with phone + password (account is active immediately), login, change password; max 2 devices per student.
- Browse published courses for the student's **own stage** (`prep3` / `sec1` / `sec3` — 3rd prep, 1st secondary, 3rd secondary); course pages are public, buying needs login.
- Buy a course (Paymob iframe) or get it free (price 0); after payment the HMAC-verified webhook creates the enrollment.
- Player with signed Bunny HLS URL, resume position, heartbeat progress every ~12 s, completion at ≥ 90 %.
- Profile with owned courses and progress.
- Floating **AI tutor** (visible only to students who own at least one course).
- On registration the student **and** the parent get a fixed WhatsApp welcome message.

### Admin panel (Arabic, RTL, dark mode)
- **Dashboard**: students by stage/status, enrollments, lessons, sales totals; cards deep-link to pre-filtered lists.
- **Students**: list/detail, suspend, reset password, grant/revoke a course (cash), kill a session, permanently delete (payments kept). Filter by monthly **commitment** (high ≥ 70 %, medium 30–69 %, low < 30 %).
- **Courses / Lessons**: CRUD, publish toggle, thumbnails, Bunny video upload, cascade-delete a course with its lessons.
- **Sales**: online + cash sales, filters, revenue summary, CSV export.
- **AI services**: upload/list/delete curriculum books (PDF, tagged with a stage); **exam generator** (form → printable paper, saved library, optional hand-written questions appended verbatim, no answer key stored).
- **Escalations**: cases the WhatsApp support agent handed over; mark resolved.
- **WhatsApp**: connection status, QR to link the number, logout, restart, test message.
- **Audit logs** for admin write actions.

### AI layer (n8n) — summary
Student tutor (curriculum-only, refuses to solve homework, stage-gated), exam generator, WhatsApp support/sales agent, weekly parent progress report, per-platform AI credit balance. See the guide.

---

## Quick start

Requirements: Node 20+, a MongoDB URI.

```bash
# Backend
cd server
cp .env.example .env        # fill in MONGODB_URI, JWT secrets, ADMIN_*, PLATFORM_* …
npm install
npm run dev                 # http://localhost:5000/api/v1  (admin is auto-seeded on first boot)

# Frontend
cd client
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1" > .env.local
npm install
npm run dev                 # http://localhost:3000
```

Scripts — server: `dev`, `build`, `start`, `lint`, `format`, `admin:update`. Client: `dev`, `build`, `start`, `lint`, `format`. There is no automated test suite or CI yet.

---

## Environment variables

Validated by Zod in `server/src/config/env.ts`; the server exits on invalid config. `server/.env.example` is the template.

| Group | Variables |
|---|---|
| Core | `NODE_ENV`, `PORT`, `API_PREFIX`, `CLIENT_URL`, `MONGODB_URI`, `DNS_SERVERS` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (≥ 32 chars), `JWT_*_EXPIRES_IN`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` |
| Limits | `BCRYPT_SALT_ROUNDS`, `MAX_DEVICES_PER_USER`, `MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`, `LESSON_COMPLETION_THRESHOLD`, `RATE_LIMIT_*` |
| Bunny Stream | `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`, `BUNNY_PULL_ZONE`, `BUNNY_TOKEN_AUTH_KEY`, `BUNNY_SIGNED_URL_TTL_SECONDS`, `BUNNY_TOKEN_BIND_IP`, `BUNNY_PLAYBACK_TOKEN_LEGACY` |
| Bunny Storage | `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_ACCESS_KEY`, `BUNNY_STORAGE_PULL_ZONE`, `BUNNY_CURRICULUM_FOLDER` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_THUMBNAIL_FOLDER` |
| Paymob | `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`, `PAYMOB_HMAC_SECRET`, `PAYMOB_BASE_URL` |
| **AI / n8n** | `N8N_WEBHOOK_BASE_URL`, `AUTOMATION_SECRET` (**this platform's own secret issued by WF15** — not a shared one), `PLATFORM_TEACHER_ID` (unique per teacher), `PLATFORM_API_HOST` (public URL n8n calls back), `PLATFORM_NAME`, `PLATFORM_SUBJECT`, `PLATFORM_AI_INSTRUCTIONS` (**required**, student-tutor identity), `PLATFORM_SUPPORT_AI_INSTRUCTIONS` (optional, WhatsApp agent identity) |
| WhatsApp | `WHATSAPP_BRIDGE_ENABLED`, `TEACHER_SUPPORT_PHONE` (escalation pings), `METERING_PROXY_URL` (voice-note transcription via the owner's metering proxy, optional) |

Client: `NEXT_PUBLIC_API_URL` only.

---

## Data models

| Model | Notes |
|---|---|
| `User` (student) | names, `studentPhone` (unique login), `parentPhone`, `stage`, `isActive`, `isSuspended`, lockout fields |
| `Admin` | the teacher; seeded from env |
| `Course` | `stage`, `price` (EGP, 0 = free), `isPublished`, cover image |
| `Lesson` | belongs to a course; `bunnyVideoId`, `videoDurationSeconds`, `publishedAt` (set once, drives "behind" logic) |
| `Enrollment` | **course ownership**: `source` = `paymob` \| `cash`, `status` = `active` \| `revoked`, one per (user, course) |
| `Payment` | Paymob attempt: `pending` → `paid` / `failed`, `merchantOrderId`, `hmacVerified` |
| `LessonProgress` | one per (user, lesson): last second, percentage, `isCompleted` |
| `Session` | device sessions (refresh-token rotation) |
| `AuditLog` | admin actions |
| `Curriculum` | metadata of an uploaded book (`bookId`, `stage`, `fileUrl`); the vectors live in n8n's `curriculum_chunks` |
| `GeneratedExam` | saved exam papers (questions only) |
| `SupportEscalation` | cases from the WhatsApp agent (`payment` / `complaint` / `question` / `other`) |
| `WhatsappSession` | Baileys auth state |

---

## API reference

Base: `/api/v1`. Responses use a `{ success, message, data }` envelope.

### Public / student
| Route | Notes |
|---|---|
| `GET /health` | uptime |
| `POST /auth/register`, `/login`, `/refresh`, `/logout`; `GET /auth/me`; `PATCH /auth/change-password` | login/register are rate-limited |
| `GET /courses/preview`, `GET /courses`, `GET /courses/:slug` | stage-filtered, `owned` flag when logged in |
| `GET /lessons/preview[/:slug]`, `GET /lessons`, `GET /lessons/:slug`, `GET /lessons/:slug/video-url` | video URL needs course ownership |
| `GET /progress`, `GET/POST /progress/:lessonId` | heartbeat |
| `POST /payments/courses/:courseId/checkout`, `GET /payments/mine`, `POST /payments/paymob/webhook` | webhook is HMAC-verified, no cookie |
| `POST /ai/student-chat` | student + owns ≥ 1 course |

### Admin (`/admin/*`, admin cookie)
| Route | Notes |
|---|---|
| `POST /admin/auth/login`, `/refresh`, `/logout`; `GET /admin/auth/me` | separate cookie pair |
| `GET /admin/dashboard` | stats |
| `/admin/students` — `GET /`, `GET /:id`, `POST /:id/suspend`, `/unsuspend`, `/reset-password`, `POST /:id/courses/:courseId/grant`, `DELETE /:id/courses/:courseId`, `DELETE /:id/sessions/:sessionId`, `DELETE /:id` | |
| `/admin/courses`, `/admin/lessons` | CRUD, `PATCH /:id/publish`, thumbnail, lesson `POST /:id/video` |
| `/admin/sales` — `GET /`, `/summary`, `/export` | |
| `/admin/escalations` — `GET /`, `PATCH /:id/resolve` | |
| `/admin/whatsapp` — `GET /status`, `/qr`; `POST /logout`, `/restart`, `/test` | |
| `/admin/audit-logs` | |
| `POST /ai/upload-curriculum`, `GET /ai/curriculum`, `DELETE /ai/curriculum/:bookId` | multipart PDF |
| `POST /ai/exam-generator`, `GET /ai/exams`, `GET/DELETE /ai/exams/:id` | |

### Internal (called by n8n only — `X-Automation-Secret`, constant-time compare against `AUTOMATION_SECRET`)
`GET /internal/ai-stats` · `GET /internal/weekly-behind-digest` · `POST /internal/notify-parent` · `POST /internal/student-self-stats` · `POST /internal/support/{identify,student-context,escalate,send-reply}` · `GET /internal/support/catalog`

---

## Access rules

- **Ownership decides everything.** A student can open a lesson only with an `active` Enrollment for that lesson's course; the AI tutor needs at least one.
- **Stage-locked purchase.** A student can only buy courses of their own stage.
- **Free courses** (price 0) are granted instantly as a `cash` enrollment.
- **Revoke** keeps the enrollment record (`revoked`); re-granting re-activates the same document.
- **Behind-lesson logic** (parent reports): a lesson counts only if the student has owned its course ≥ 5 days **and** it was published ≥ 5 days ago; < 10 % watched = "not opened", otherwise < 90 % = "not completed".
- **Monthly commitment**: lessons completed this month ÷ lessons published this month in courses the student owns.

---

## External services

| Service | Used for | Where configured |
|---|---|---|
| Bunny Stream | lesson video, signed HLS URLs | `BUNNY_*` |
| Bunny Storage | original curriculum PDFs (admin "open original" link) | `BUNNY_STORAGE_*` |
| Cloudinary | lesson/course thumbnails | `CLOUDINARY_*` |
| Paymob | card payments; dashboard callbacks: processed → `POST /api/v1/payments/paymob/webhook`, response → `<client>/payment/callback` | `PAYMOB_*` |
| WhatsApp (Baileys) | digest, welcome, support replies, escalation pings; link the number once via the admin **WhatsApp** page (QR) | `WHATSAPP_BRIDGE_ENABLED` |
| n8n + OpenAI + Atlas | the AI layer | `N8N_WEBHOOK_BASE_URL`, `AUTOMATION_SECRET` |

---

## Security

- JWT in HttpOnly cookies; separate cookie pairs for students and admins; refresh-token rotation; account lockout; bcrypt (configurable cost).
- Helmet, strict CORS to `CLIENT_URL`, `mongo-sanitize`, `hpp`, Zod on every body, tiered rate limits (the global limiter does not count a logged-in admin; the admin login keeps its own limit of 5 failed attempts / 15 min).
- Bunny signed playback URLs (short TTL, folder-scoped; IP binding is opt-in).
- Paymob webhook verified by HMAC; audit log for admin writes.
- n8n ↔ backend: shared-per-platform secret in `X-Automation-Secret`; n8n checks it against that platform's row, the backend against its env. User-facing AI routes never expose the secret to the browser.
- Never commit real secrets — `.env` is git-ignored (`.env.example` is tracked; see below).

---

## Standing a new teacher up

1. Deploy a fresh backend + client + MongoDB database for the teacher; set a **new, unique** `PLATFORM_TEACHER_ID` (reusing one mixes two teachers' data inside n8n).
2. Provision the platform on n8n (owner-only, WF15) and put the returned secret in `AUTOMATION_SECRET`.
3. Set `PLATFORM_API_HOST`, `PLATFORM_NAME`, `PLATFORM_SUBJECT`, `PLATFORM_AI_INSTRUCTIONS`, Paymob/Bunny/Cloudinary credentials.
4. Boot the server (it registers its host with n8n via WF11), link WhatsApp from the admin panel, optionally set an AI credit balance (WF16).

Exact request shapes and the full checklist are in [`AI_SYSTEM_GUIDE.md`](./AI_SYSTEM_GUIDE.md#6-إضافة-مدرس-جديد-onboarding).

---

## Known loose ends

- `server/.env.example` still contains a concrete-looking `AUTOMATION_SECRET`; since secrets are now per-platform it should be a placeholder, and any value that was ever real should be rotated.
- Some code comments still describe the old model (shared secret, teacher-chat WF3, `WF3/WF4/WF6` rotation notes) — see `config/env.ts`, `routes/index.ts`, `internal.routes.ts`, `automationSecret.middleware.ts`.
- `node-cron` is a dependency but unused; the weekly parent report is scheduled by n8n (WF7), not the backend.
- `server/_to_delete/` and `Claude outputs/` are leftovers.
- No automated tests / CI.
