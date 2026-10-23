"use client";

/**
 * Curriculum management for the AI assistant.
 *
 * Combines three things in one page so the teacher never has to jump around:
 *   1) A list of every book they've uploaded, with size + indexed-at.
 *   2) A "Replace" action that pre-fills the upload form with the book's id
 *      so uploading a fresh PDF version overwrites the vector chunks in place.
 *   3) A "Delete" action that removes the book from the retrieval index
 *      permanently, guarded by a confirmation dialog.
 *
 * All three actions go through the Express /ai/curriculum endpoints, which
 * route to n8n workflows for the actual indexing / deletion. The teacher
 * never has to know the pipeline exists.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import {
  aiApi,
  isApiError,
  type CurriculumBook,
  type CurriculumStatus,
} from "@/api";
import { cn } from "@/shared/lib/cn";
import { STAGE_LONG_LABELS, STAGE_VALUES, type Stage } from "@/shared/lib/stage";
import {
  MAX_PDF_MB,
  describeIndexingFailure,
  describeUploadError,
  uploadErrorForCode,
  type UploadErrorInfo,
} from "./curriculumUploadError";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

interface FormState {
  book_id: string;
  book_version: string;
  /** Which academic year the book teaches — "" until the teacher picks one. */
  stage: Stage | "";
}

/**
 * The platform's academic years, as VALUES not labels.
 *
 * This form used to submit the Arabic label as free text. It now submits the
 * stage enum — the same one lessons and students use — because the assistant
 * compares a book's year against the asking student's year, and two strings
 * that merely look alike are not a match. The label is display only.
 */
const STAGE_OPTIONS: readonly Stage[] = STAGE_VALUES;

const EMPTY_FORM: FormState = {
  book_id: "",
  book_version: "1",
  stage: "",
};

export function CurriculumManagementView() {
  const [items, setItems] = useState<CurriculumBook[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  // Remounts the hidden <input type="file"> so clearing the state actually
  // resets its underlying value (React can't set that directly). Bump the
  // key on every clear so re-picking the same file still fires onChange.
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replacingBookId, setReplacingBookId] = useState<string | null>(null);
  // Why the last upload failed — shown as a banner at the top of the page
  // (a toast vanishes before the admin can read a long explanation).
  const [uploadError, setUploadError] = useState<UploadErrorInfo | null>(null);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CurriculumBook | null>(null);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CurriculumBook | null>(null);
  const [cancellingBookId, setCancellingBookId] = useState<string | null>(null);
  // Books the admin just cancelled: when one of them comes back as "ready"
  // (a replacement restored to its old version) that is NOT a finished
  // indexing run, so it must not trigger the "تم فهرسة" notice.
  const cancelledRef = useRef<Set<string>>(new Set());
  const uploadCardRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearFile = useCallback(() => {
    setFile(null);
    setFileInputKey((k) => k + 1);
  }, []);

  // `silent` is the background refresh while a book is indexing: a failed one
  // is simply retried on the next tick, not worth an error on screen.
  const loadItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setListError(null);
      const res = await aiApi.listCurriculum();
      setItems(res.items);
    } catch (err) {
      if (silent) return;
      setItems([]);
      if (isApiError(err)) {
        setListError(err.message);
      } else {
        setListError("تعذّر تحميل قائمة المناهج.");
      }
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Indexing continues on the server after the upload returns, so keep the
  // list fresh while any book is still being indexed.
  const hasIndexing = items?.some((b) => b.status === "indexing") ?? false;
  useEffect(() => {
    if (!hasIndexing) return;
    const timer = window.setInterval(() => void loadItems(true), 8000);
    return () => window.clearInterval(timer);
  }, [hasIndexing, loadItems]);

  // Tell the admin when a book they uploaded finishes (or fails) in the
  // background — they may have left the page and come back.
  const lastStatusRef = useRef<Map<string, CurriculumStatus>>(new Map());
  useEffect(() => {
    if (!items) return;
    for (const book of items) {
      if (lastStatusRef.current.get(book.book_id) !== "indexing") continue;
      if (cancelledRef.current.delete(book.book_id)) continue;
      if (book.status === "ready") {
        toast.success(
          `تم فهرسة "${book.book_id}" — المساعد الذكي بقى يقدر يستخدمه.`,
        );
      } else if (book.status === "failed") {
        setUploadError(describeIndexingFailure(book));
      }
    }
    lastStatusRef.current = new Map(items.map((b) => [b.book_id, b.status]));
  }, [items]);

  // The upload form sits below the book list, so bring the banner into view.
  useEffect(() => {
    if (uploadError) {
      errorBannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [uploadError]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const startReplace = useCallback((book: CurriculumBook) => {
    setForm({
      book_id: book.book_id,
      book_version: String(book.book_version + 1),
      // Carry the book's year over so replacing a book doesn't silently
      // re-file it under a different one.
      stage: book.stage ?? "",
    });
    setFile(null);
    setFileInputKey((k) => k + 1);
    setReplacingBookId(book.book_id);
    // Small delay so state has settled, then scroll the upload card into view.
    window.setTimeout(() => {
      uploadCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 40);
  }, []);

  const cancelReplace = useCallback(() => {
    setReplacingBookId(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setFileInputKey((k) => k + 1);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const bookIdOk = /^[a-zA-Z0-9_-]{1,64}$/.test(form.book_id.trim());
    if (!bookIdOk) {
      setUploadError(uploadErrorForCode("BAD_BOOK_ID"));
      return;
    }
    // Catch a reused id here so a big PDF is not uploaded just to be refused.
    // (The backend enforces the same rule; this only saves the wait.)
    if (
      !replacingBookId &&
      items?.some((b) => b.book_id === form.book_id.trim())
    ) {
      setUploadError(uploadErrorForCode("BOOK_ID_EXISTS"));
      return;
    }
    if (!file) {
      setUploadError(uploadErrorForCode("NO_FILE"));
      return;
    }
    if (
      file.type &&
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setUploadError(uploadErrorForCode("NOT_PDF"));
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setUploadError(uploadErrorForCode("FILE_TOO_LARGE"));
      return;
    }
    if (!form.stage) {
      setUploadError(uploadErrorForCode("NO_STAGE"));
      return;
    }
    const version = Number(form.book_version) || 1;

    setUploadError(null);
    setIsSubmitting(true);
    try {
      const res = await aiApi.uploadCurriculum({
        book_id: form.book_id.trim(),
        book_version: version,
        file,
        stage: form.stage,
        replace: Boolean(replacingBookId),
      });
      if (res?.status === "indexing") {
        toast.success(
          `اتبعت "${form.book_id}" للفهرسة — ممكن تقفل الصفحة، وهتشوف حالته في القايمة.`,
        );
      } else {
        toast.success(
          replacingBookId
            ? `تم استبدال "${form.book_id}" بالنسخة الجديدة.`
            : `تم فهرسة "${form.book_id}" — المساعد الذكي بقى يقدر يستخدمه.`,
        );
      }
      setForm(EMPTY_FORM);
      setFile(null);
      setFileInputKey((k) => k + 1);
      setReplacingBookId(null);
      await loadItems();
    } catch (err) {
      setUploadError(describeUploadError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancellingBookId) return;
    const bookId = cancelTarget.book_id;
    setCancellingBookId(bookId);
    cancelledRef.current.add(bookId);
    try {
      const res = await aiApi.cancelCurriculumIndexing(bookId);
      toast.success(
        res.outcome === "restored"
          ? `اتلغت فهرسة "${bookId}" ورجع الكتاب للنسخة القديمة.`
          : `اتلغت فهرسة "${bookId}" واتشال الكتاب.`,
      );
      setCancelTarget(null);
      await loadItems();
    } catch (err) {
      cancelledRef.current.delete(bookId);
      toast.error(
        isApiError(err) && err.message
          ? err.message
          : "مقدرناش نلغي الفهرسة دلوقتي. حاول تاني.",
      );
      // The run may have just finished (or already been cancelled): show the truth.
      setCancelTarget(null);
      await loadItems();
    } finally {
      setCancellingBookId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingBookId) return;
    const bookId = deleteTarget.book_id;
    setDeletingBookId(bookId);
    try {
      await aiApi.deleteCurriculum(bookId);
      toast.success(`اتحذف الكتاب "${bookId}".`);
      setDeleteTarget(null);
      await loadItems();
    } catch (err) {
      let msg = "حصل خطأ أثناء الحذف. جرّب تاني.";
      if (isApiError(err)) {
        if (err.statusCode === 404) msg = "الكتاب مش موجود بالفعل.";
        else if (err.message) msg = err.message;
      }
      toast.error(msg);
    } finally {
      setDeletingBookId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">
            منهج المساعد الذكي
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل الكتب المرفوعة تحت — يقدر المساعد الذكي يجاوب ويولد امتحانات
            منها. استبدل نسخة قديمة، أو احذف كتاب لو مش محتاجه.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CountBadge count={items?.length ?? null} />
        </div>
      </header>

      {uploadError && (
        <UploadErrorBanner
          ref={errorBannerRef}
          info={uploadError}
          onDismiss={() => setUploadError(null)}
        />
      )}

      {/* List */}
      <section className="space-y-3">
        {items === null && <LoadingScreen variant="page" />}

        {items !== null && listError && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
            {listError}
          </div>
        )}

        {items !== null && !listError && items.length === 0 && <EmptyList />}

        {items !== null && items.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((book) => (
              <BookCard
                key={book.book_id}
                book={book}
                onReplace={() => startReplace(book)}
                onDelete={() => setDeleteTarget(book)}
                onCancelIndexing={() => setCancelTarget(book)}
                isCancelling={cancellingBookId === book.book_id}
                isDeleting={deletingBookId === book.book_id}
                isBeingReplaced={replacingBookId === book.book_id}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Upload form */}
      <section
        ref={uploadCardRef}
        className={cn(
          "rounded-2xl border bg-card p-5 shadow-sm sm:p-6",
          replacingBookId
            ? "border-primary/50 ring-2 ring-primary/15"
            : "border-border",
        )}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">
              {replacingBookId
                ? `استبدال "${replacingBookId}" بنسخة جديدة`
                : "رفع منهج جديد"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              ارفع ملف الـ PDF من جهازك مباشرة — مفيش داعي لرابط أو استضافة
              خارجية، إحنا بنتكفل بده.
            </p>
          </div>
          {replacingBookId && (
            <button
              type="button"
              onClick={cancelReplace}
              className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
            >
              إلغاء الاستبدال
            </button>
          )}
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="رقم الكتاب" required htmlFor="book_id">
              <input
                id="book_id"
                type="text"
                value={form.book_id}
                onChange={(e) => update("book_id", e.target.value)}
                required
                disabled={isSubmitting || Boolean(replacingBookId)}
                placeholder="مثلاً arabic_grade10_term1"
                className={inputCls}
              />
              <FieldHint>
                {replacingBookId
                  ? "مقفول أثناء الاستبدال — الرقم بيبقى ثابت."
                  : "حروف/أرقام/شرطة فقط."}
              </FieldHint>
            </Field>

            <Field label="الإصدار" htmlFor="book_version">
              <input
                id="book_version"
                type="number"
                min={1}
                value={form.book_version}
                onChange={(e) => update("book_version", e.target.value)}
                disabled={isSubmitting}
                className={inputCls}
              />
              <FieldHint>
                {replacingBookId ? "زوّده كل مرة تستبدل نسخة." : "ابدأ من 1."}
              </FieldHint>
            </Field>
          </div>

          <Field label="ملف PDF" required htmlFor="file">
            {/*
              Hidden native input drives the OS file picker. Choosing a file
              swaps the visible UI to a "chosen file card" with clear/replace
              actions so the teacher can undo a wrong choice OR pick a
              different file — both without submitting first.
              key={fileInputKey} lets `clearFile` reset the input's internal
              value (React can't set the .value of a file input directly), so
              picking THE SAME file again after a clear still fires onChange.
            */}
            <input
              key={fileInputKey}
              id="file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isSubmitting}
              className="sr-only"
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className={cn(
                  "flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background px-4 py-6 text-sm font-bold text-foreground transition-colors",
                  "hover:border-primary hover:bg-primary/5 hover:text-primary",
                  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background disabled:hover:text-foreground",
                )}
              >
                <UploadIcon />
                <span>
                  {replacingBookId
                    ? "اختار نسخة PDF جديدة"
                    : "اختار ملف PDF من جهازك"}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PdfIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {file.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    title="اختار ملف تاني بدل اللي فوق"
                  >
                    تغيير
                  </button>
                  <button
                    type="button"
                    onClick={clearFile}
                    disabled={isSubmitting}
                    aria-label="إلغاء اختيار الملف"
                    title="إلغاء اختيار الملف"
                    className="flex size-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
            )}

            <FieldHint>
              {file
                ? 'دوس "تغيير" لاختيار ملف تاني، أو ✕ عشان تلغي.'
                : replacingBookId
                  ? "اختار نسخة PDF جديدة عشان تستبدل بها القديمة."
                  : `PDF فقط، حتى ${MAX_PDF_MB} ميجا.`}
            </FieldHint>
          </Field>

          <Field label="الصف الدراسي" required htmlFor="stage">
            <select
              id="stage"
              value={form.stage}
              onChange={(e) => update("stage", e.target.value as Stage)}
              disabled={isSubmitting}
              className={cn(inputCls, "cursor-pointer appearance-none pr-9")}
              style={{
                // Simple chevron so the select doesn't look like a plain input;
                // uses currentColor so it works in both light and dark modes.
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='1 1.5 6 6.5 11 1.5'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "left 0.9rem center",
                backgroundSize: "0.75rem",
              }}
            >
              <option value="" disabled>
                اختار الصف الدراسي…
              </option>
              {STAGE_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {STAGE_LONG_LABELS[st]}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              الفهرسة عادةً بتاخد من ثواني لدقيقة حسب حجم الملف.
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-bold text-primary-foreground shadow-brand transition-transform hover:scale-[1.02] active:scale-95",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100",
              )}
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon />
                  <span>جاري الفهرسة…</span>
                </>
              ) : replacingBookId ? (
                "استبدال بالنسخة الجديدة"
              ) : (
                "رفع وفهرسة"
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Cancel-indexing confirmation modal */}
      {cancelTarget && (
        <CancelIndexingDialog
          book={cancelTarget}
          isCancelling={cancellingBookId === cancelTarget.book_id}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => void confirmCancel()}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmDialog
          book={deleteTarget}
          isDeleting={deletingBookId === deleteTarget.book_id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const UploadErrorBanner = forwardRef<
  HTMLDivElement,
  { info: UploadErrorInfo; onDismiss: () => void }
>(function UploadErrorBanner({ info, onDismiss }, ref) {
  const technical = [info.code, info.technical].filter(Boolean).join(" · ");
  return (
    <div
      ref={ref}
      role="alert"
      className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
          <AlertIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-foreground">
            {info.title}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            {info.message}
          </p>
          {technical && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              رمز الخطأ (ابعته للمطوّر):{" "}
              <span dir="ltr" className="font-mono">
                {technical}
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق رسالة الخطأ"
          title="إغلاق"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
        >
          <XIcon />
        </button>
      </div>
    </div>
  );
});

function BookCard({
  book,
  onReplace,
  onDelete,
  onCancelIndexing,
  isCancelling,
  isDeleting,
  isBeingReplaced,
}: {
  book: CurriculumBook;
  onReplace: () => void;
  onDelete: () => void;
  onCancelIndexing: () => void;
  isCancelling: boolean;
  isDeleting: boolean;
  isBeingReplaced: boolean;
}) {
  const indexedAt = new Date(book.indexed_at);
  const isIndexing = book.status === "indexing";
  const isFailed = book.status === "failed";
  return (
    <li
      className={cn(
        "group flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        isBeingReplaced
          ? "border-primary/50 ring-2 ring-primary/15"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-extrabold text-foreground">
              {book.book_id}
            </h3>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">
              v{book.book_version}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[book.subject, book.grade].filter(Boolean).join(" · ") ||
              "بدون تفاصيل"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-2 text-[11px]">
        {book.status === "ready" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <ClockIcon />
            <span>آخر فهرسة: {formatDate(indexedAt)}</span>
          </div>
        )}
        {book.file_url && !isFailed && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <LinkIcon />
            <a
              href={book.file_url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-primary underline-offset-2 hover:underline"
            >
              فتح الرابط الأصلي
            </a>
          </div>
        )}
      </dl>

      {isIndexing && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11.5px] leading-relaxed text-foreground"
        >
          <span className="mt-0.5 shrink-0">
            <SpinnerIcon />
          </span>
          <span>
            جاري الفهرسة في الخلفية
            {formatElapsed(book.indexing_started_at)} — الكتب المتصوّرة الكبيرة
            ممكن تاخد وقت طويل. مفيش داعي تفضل فاتح الصفحة.
          </span>
        </div>
      )}

      {isFailed && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-[11.5px] leading-relaxed text-foreground"
        >
          <p className="font-bold text-destructive">فشلت الفهرسة</p>
          {book.error_message && <p className="mt-1">{book.error_message}</p>}
          {book.error_code && (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground">
              رمز الخطأ:{" "}
              <span dir="ltr" className="font-mono">
                {book.error_code}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        {isIndexing ? (
          <button
            type="button"
            onClick={onCancelIndexing}
            disabled={isCancelling}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
          >
            {isCancelling ? <SpinnerIcon /> : <XIcon />}
            إلغاء الفهرسة
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onReplace}
              disabled={isDeleting || isIndexing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <ReplaceIcon />
              استبدال
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting || isIndexing}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {isDeleting ? <SpinnerIcon /> : <TrashIcon />}
              حذف
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function CancelIndexingDialog({
  book,
  isCancelling,
  onClose,
  onConfirm,
}: {
  book: CurriculumBook;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <XIcon />
          </div>
          <h3 className="text-lg font-extrabold text-foreground">
            إلغاء الفهرسة؟
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          هتتوقف فهرسة كتاب{" "}
          <span className="font-bold text-foreground">{book.book_id}</span> ومش
          هتتكمل. لو الكتاب جديد هيتشال خالص، ولو كنت بتستبدل نسخة قديمة هترجع
          النسخة القديمة زي ما كانت.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50"
          >
            كمّل الفهرسة
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isCancelling && <SpinnerIcon />}
            <span>{isCancelling ? "جاري الإلغاء…" : "أكيد، ألغي الفهرسة"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmDialog({
  book,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  book: CurriculumBook;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TrashIcon />
          </div>
          <h3 className="text-lg font-extrabold text-foreground">
            حذف الكتاب؟
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          هيتحذف كتاب{" "}
          <span className="font-bold text-foreground">{book.book_id}</span>{" "}
          نهائيًا من المساعد الذكي. المساعد مش هيقدر يجاوب من محتواه بعد كده،
          والإجراء ده لا يمكن التراجع عنه.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isDeleting && <SpinnerIcon />}
            <span>{isDeleting ? "جاري الحذف…" : "أكيد، احذف"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CountBadge({ count }: { count: number | null }) {
  return (
    <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground">
      {count === null ? "…" : `${count} كتاب مرفوع`}
    </div>
  );
}

function EmptyList() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BookIcon large />
      </div>
      <h3 className="text-base font-extrabold text-foreground">
        لسه ما رفعتش منهج
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        ارفع أول كتاب من الفورم تحت — المساعد الذكي هيقدر يجاوب على محتواه
        ويولّد منه امتحانات.
      </p>
    </div>
  );
}


function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-bold text-foreground"
      >
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

const inputCls =
  "block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

/** "2.3 MB" / "812 KB" / "412 B" — western digits are readable inside RTL context. */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** " (بدأت من 12 دقيقة)" — empty when the start time is unknown. */
function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "";
  const minutes = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 60000,
  );
  if (!Number.isFinite(minutes) || minutes < 1) return " (لسه بادية)";
  return ` (بدأت من ${minutes} دقيقة)`;
}

function formatDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

// ── Icons ────────────────────────────────────────────────────────────────────

function BookIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? "size-6" : "size-5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ReplaceIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9v-3zm0 3v2" />
      <path d="M13.5 13v5" />
      <path d="M17 13h-2v5h2m-2-2.5h1.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
