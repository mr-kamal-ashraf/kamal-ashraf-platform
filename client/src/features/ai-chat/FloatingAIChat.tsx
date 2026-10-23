"use client";

/**
 * Floating AI tutor for logged-in, subscribed students.
 *
 * UX:
 *   - Round floating button pinned to the bottom-left (RTL page → visual right).
 *     Tap opens a chat panel; tap again (or the X) closes it.
 *   - On mount, the panel fetches this student's own chat history from the
 *     server (GET /ai/student-chat/history) and repopulates the message
 *     list — messages are no longer lost on reload, since the server (not
 *     React state) is the source of truth. localStorage still remembers the
 *     server-issued conversation_id as a hint for which thread to continue,
 *     but even without it the history endpoint falls back to this student's
 *     most recent thread.
 *   - "محادثة جديدة" (new chat) generates a fresh conversation_id client-side
 *     and clears the panel, so the NEXT message really does start a new
 *     thread server-side rather than silently resuming the old one.
 *   - "مسح كل الرسائل" (clear everything) permanently deletes every stored
 *     message for this student, after an inline confirm step — used for
 *     clean-slate testing.
 *   - Blocked messages (solve-request guardrail) are shown with a subtle
 *     amber left-border so the student sees "the AI didn't just refuse to
 *     answer, it declined because you asked me to solve it".
 *   - Never mounts if the student is not logged in.
 *
 * IMPORTANT: this component NEVER touches n8n directly. It calls the Express
 * backend at /api/v1/ai/student-chat, which authenticates via the session
 * cookie, derives student_id/teacher_id server-side, then talks to n8n with
 * the automation secret. The client never sees that secret.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { aiApi, isApiError } from "@/api";
import { cn } from "@/shared/lib/cn";
import {
  ChatBotIcon,
  ChatBrushIcon,
  ChatCloseIcon,
  ChatNewIcon,
  ChatSendIcon,
  ChatSparkleIcon,
  ChatWarningIcon,
} from "./components/icons";

// One message rendered in the panel. `blocked` is used for a distinct style
// on refusals so the student instantly reads it as a coaching moment,
// not a bug or an outage.
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocked?: boolean;
}

const CONVERSATION_STORAGE_KEY = "ai-chat:conversation-id";

/**
 * Builds the fixed welcome bubble shown at the top of every fresh
 * conversation (first open, or after "محادثة جديدة"). This is a STATIC
 * client-side template — the only dynamic part is the student's first name,
 * which comes from `useAuth().user` (already resolved from their session
 * cookie/token via GET /auth/me, never re-typed by the student). The text
 * itself is never sent to the backend/n8n and never AI-generated, so it
 * costs nothing and stays identical in tone for every student — only the
 * name changes.
 *
 * This is computed fresh on every render (see `welcomeMessage` in the
 * component below) rather than stored in `messages` state, specifically so
 * it always reflects the CURRENT student — state captured once at mount
 * could still show "أهلاً بيك!" with no name if `user` hadn't loaded yet.
 *
 * Content spells out what the assistant can actually do (explain, answer
 * questions, help review) so the student knows how to use it well — but
 * deliberately leaves out INTERNAL MECHANICS: that answers are restricted to
 * what the teacher uploaded, how the no-match refusal works, etc. Those are
 * for the teacher to know, not something to spell out to the student.
 */
function buildWelcomeMessage(firstName: string | undefined): ChatMessage {
  const greeting = firstName ? `يا ${firstName}` : "";
  return {
    id: "welcome",
    role: "assistant",
    content:
      `أهلاً ${greeting}! 👋 مبسوط إني هساعدك النهارده.\n\n` +
      "أقدر أساعدك في حاجات كتير:\n\n" +
      "• أشرحلك أي مفهوم أو درس مش فاهمه\n" +
      "• أجاوب على أسئلتك في المادة وأوضحلك أي نقطة بتلخبطك\n" +
      "• أساعدك تراجع وتتأكد إنك ماسك المادة صح\n" +
      "• أديك أمثلة وتوضيحات تساعدك تفهم أكتر 💪\n\n" +
      "حاجة واحدة بس: مش هحل الواجب أو الامتحان بدالك، هساعدك تفهم عشان تقدر تحله بنفسك.\n\n" +
      "يلا بينا، اسألني عن أي حاجة! ✨",
  };
}

// Path fragments the floating button should NOT appear on. Admins have their
// own dedicated chat inside the panel; the auth pages and player would be
// distracting; the profile page can keep it, but we hide it during checkout-
// style flows if they ever get added.
const HIDDEN_PREFIXES = ["/admin", "/login", "/register", "/player/"];

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * A fresh, opaque conversation id generated entirely client-side — used by
 * "new chat" so the NEXT message genuinely starts a new thread server-side.
 * (If we instead cleared the id to undefined, the backend/n8n would fall
 * back to a deterministic default derived from the student's own id, which
 * is the SAME value every time — "new chat" would silently resume the old
 * thread instead of starting fresh.)
 */
function makeConversationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `web_${makeId()}`;
}

function readStoredConversationId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = localStorage.getItem(CONVERSATION_STORAGE_KEY);
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

function storeConversationId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(CONVERSATION_STORAGE_KEY, id);
    else localStorage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch {
    // Ignore storage errors (private-browsing / disabled cookies).
  }
}

export function FloatingAIChat() {
  const { user, isLoading: authLoading } = useAuth();
  const pathname = usePathname() ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const historyLoadedRef = useRef(false);
  // Recomputed whenever the student's first name changes (e.g. loads in after
  // the panel first mounts) — see buildWelcomeMessage's doc comment for why
  // this lives outside `messages` state.
  const welcomeMessage = useMemo(
    () => buildWelcomeMessage(user?.firstName),
    [user?.firstName],
  );
  const conversationIdRef = useRef<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Fetch this student's own chat history ONCE per mount (not once per panel
  // open — the component stays mounted for the whole session, so this covers
  // "open the chat at any time and find your old messages"; a real page
  // reload remounts the component and re-fetches, which is the case that
  // used to lose everything). Prefer the thread id already remembered in
  // localStorage (continues the exact same thread); fall back to asking the
  // server for this student's most recent thread, then re-sync localStorage
  // with whatever the server resolves to.
  useEffect(() => {
    if (!user?._id || !user.hasOwnedCourse || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    (async () => {
      setIsLoadingHistory(true);
      try {
        const storedId = readStoredConversationId();
        const history = await aiApi.getChatHistory(storedId);
        conversationIdRef.current = history.conversation_id ?? undefined;
        storeConversationId(history.conversation_id);
        if (history.messages.length > 0) {
          setMessages(
            history.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              blocked: m.wasBlocked,
            })),
          );
        }
      } catch {
        // History is a nice-to-have, not critical — a failed fetch just
        // means the panel starts blank, same as it always has.
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, [user?._id, user?.hasOwnedCourse]);

  // Collapse the "clear everything" confirm step whenever the panel closes,
  // so it doesn't reappear mid-confirm the next time it's opened.
  useEffect(() => {
    if (!isOpen) setConfirmingClear(false);
  }, [isOpen]);

  // Auto-scroll to the newest message every time messages or the sending flag change.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  // Focus the textarea when the panel opens; nice on desktop, no-op on touch.
  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    if (trimmed.length > 1000) {
      toast.error("الرسالة طويلة جدًا. حاول تختصر لأقل من 1000 حرف.");
      return;
    }

    const userMsg: ChatMessage = { id: makeId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await aiApi.studentChat({
        message: trimmed,
        conversation_id: conversationIdRef.current,
      });

      if (res.conversation_id) {
        conversationIdRef.current = res.conversation_id;
        storeConversationId(res.conversation_id);
      }

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: res.reply || "…",
        blocked: Boolean(res.was_blocked),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      let msg = "حصل خطأ أثناء إرسال الرسالة. جرّب تاني بعد شوية.";
      if (isApiError(err)) {
        if (err.code === "AI_RATE_LIMIT" || err.statusCode === 429) {
          msg =
            "وصلت للحد اليومي من الرسائل. رجعلي بكرا أو كلم أستاذك لو حاجة عاجلة.";
        } else if (err.statusCode === 401) {
          msg = "الجلسة انتهت. اعمل تسجيل دخول من جديد.";
        }
      }
      toast.error(msg);
      // Roll back the local optimistic user message so the student can retry
      // without seeing an unanswered question hanging.
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  // Starts a genuinely new thread: a fresh id means the next message can't
  // match any existing history server-side (see makeConversationId's doc
  // comment for why clearing to undefined alone did not work).
  const startNewChat = useCallback(() => {
    if (isSending) return;
    setMessages([]);
    const freshId = makeConversationId();
    conversationIdRef.current = freshId;
    storeConversationId(freshId);
    toast.success("محادثة جديدة.");
  }, [isSending]);

  // Permanently deletes every message this student has ever exchanged with
  // the AI, across every thread — not just the current one. Gated behind
  // `confirmingClear` (an inline, self-built confirm step) since this can't
  // be undone.
  const clearEverything = useCallback(async () => {
    if (isSending || isClearing) return;
    setIsClearing(true);
    try {
      await aiApi.clearChatHistory();
      setMessages([]);
      conversationIdRef.current = undefined;
      storeConversationId(null);
      toast.success("تم مسح كل الرسائل.");
    } catch {
      toast.error("حصل خطأ أثناء مسح الرسائل. جرّب تاني.");
    } finally {
      setIsClearing(false);
      setConfirmingClear(false);
    }
  }, [isSending, isClearing]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter, allow Shift+Enter for a newline.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  // Gate rendering AFTER hooks so we don't violate the rules of hooks when
  // the auth state changes between visits.
  const shouldHide =
    authLoading ||
    !user ||
    !user.hasOwnedCourse ||
    HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));

  if (shouldHide) return null;

  return (
    <>
      {/* Floating action button — pinned to bottom-start (visual right in RTL). */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "إغلاق المساعد الذكي" : "افتح المساعد الذكي"}
        aria-expanded={isOpen}
        className={cn(
          // The platform button (see .btn in styles.css) as a round pebble.
          "btn btn-primary btn-icon fixed bottom-5 z-[70] size-14 rounded-full",
          // start-5 = right-5 in RTL. Tailwind logical properties keep both
          // LTR and RTL correct without extra guards.
          "start-5",
        )}
      >
        {isOpen ? <ChatCloseIcon /> : <ChatSparkleIcon />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ai-chat-panel"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "fixed bottom-24 z-[70] flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
              "start-5",
            )}
            style={{ height: "min(70vh, 560px)" }}
            role="dialog"
            aria-modal="false"
            aria-label="المساعد الذكي"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-brand px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-white/20">
                  <ChatBotIcon />
                </div>
                <div>
                  <div className="text-sm font-extrabold">
                    مساعدك الذكي
                  </div>
                  <div className="text-[11px] opacity-90">
                    بيجاوب من منهج أستاذك بس
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={startNewChat}
                  aria-label="محادثة جديدة"
                  title="محادثة جديدة"
                  className="flex size-8 items-center justify-center rounded-lg text-primary-foreground/90 hover:bg-white/15"
                >
                  <ChatNewIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear((v) => !v)}
                  aria-label="مسح كل الرسائل"
                  title="مسح كل الرسائل"
                  className="flex size-8 items-center justify-center rounded-lg text-primary-foreground/90 hover:bg-white/15"
                >
                  <ChatBrushIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="إغلاق"
                  className="flex size-8 items-center justify-center rounded-lg text-primary-foreground/90 hover:bg-white/15"
                >
                  <ChatCloseIcon />
                </button>
              </div>
            </div>

            {/* Inline confirm step for the destructive "clear everything"
                action — never a native window.confirm, to match the rest of
                the app's self-built confirm UI. */}
            {confirmingClear && (
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-foreground">
                <span>هيتم مسح كل الرسائل نهائيًا، متأكد؟</span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={clearEverything}
                    disabled={isClearing}
                    className="btn btn-danger btn-sm"
                  >
                    {isClearing ? "جارِ المسح…" : "مسح الكل"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    disabled={isClearing}
                    className="btn btn-secondary btn-sm"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            {/* Messages list */}
            <div
              ref={listRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            >
              {isLoadingHistory && (
                <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                  <span className="animate-pulse">بيحمّل آخر رسائلك…</span>
                </div>
              )}
              <ChatBubble message={welcomeMessage} />
              {messages.map((m) => (
                <ChatBubble key={m.id} message={m} />
              ))}
              {isSending && <ThinkingBubble />}
            </div>

            {/* Composer */}
            <form
              className="border-t border-border bg-background/60 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="اسأل عن أي حاجة من الدرس…"
                  rows={1}
                  maxLength={1000}
                  disabled={isSending}
                  className={cn(
                    "min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground",
                    "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                />
                <button
                  type="submit"
                  disabled={isSending || input.trim().length === 0}
                  aria-label="إرسال"
                  className="btn btn-primary btn-icon shrink-0"
                >
                  <ChatSendIcon />
                </button>
              </div>
              <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
                الردود مبنية على محتوى أستاذك بس، مش على معلومات عامة.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ChatBotIcon />
      </div>
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-3 py-2">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex items-start gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary/15 text-primary"
            : message.blocked
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? (
          <span className="text-xs font-bold">أنا</span>
        ) : message.blocked ? (
          <ChatWarningIcon />
        ) : (
          <ChatBotIcon />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-brand text-primary-foreground shadow-brand"
            : message.blocked
            ? "border border-amber-500/40 bg-amber-500/10 text-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
