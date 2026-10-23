"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminCourseCodesApi,
  isApiError,
  type CourseCodeStatus,
  type CourseCodesResult,
  type GeneratedCodes,
} from "@/api";
import { Field } from "@/features/admin/lessons/components/Field";
import { useConfirm } from "@/features/admin/shared/confirm/ConfirmProvider";
import { useDebounced } from "@/shared/hooks/useDebounced";
import { cn } from "@/shared/lib/cn";
import { LoadingScreen } from "@/shared/ui/LoadingScreen";

const INPUT =
  "min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
const SMALL_BTN =
  "inline-flex min-h-[34px] items-center justify-center whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50";

const STATUS: Record<CourseCodeStatus, { label: string; className: string }> = {
  available: {
    label: "متاح",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  used: {
    label: "مستخدم",
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  disabled: {
    label: "متوقف",
    className: "border-border bg-muted text-muted-foreground",
  },
};

const dateText = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function printHref(courseId: string, batchId?: string) {
  const params = new URLSearchParams({ courseId, status: "available" });
  if (batchId) params.set("batchId", batchId);
  return `/admin/codes-print?${params.toString()}`;
}

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("المتصفح مسمحش بالنسخ — انسخ يدوي.");
  }
}

/**
 * أكواد الكورس: generate a batch of prepaid codes for this course, print or
 * export them to sell offline, see who used which code, and delete codes
 * (one, or a selection) for good. A student types a code on the course page
 * and the course opens for them.
 */
export function CourseCodesSection({
  courseId,
  coursePrice,
  published,
}: {
  courseId: string;
  coursePrice: number;
  published: boolean;
}) {
  const confirm = useConfirm();
  const [data, setData] = useState<CourseCodesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"" | CourseCodeStatus>("");
  const [batchId, setBatchId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim(), 350);

  const [count, setCount] = useState("20");
  const [price, setPrice] = useState(String(coursePrice));
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastBatch, setLastBatch] = useState<GeneratedCodes | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminCourseCodesApi.list({
        courseId,
        status: status || undefined,
        batchId: batchId || undefined,
        search: debouncedSearch || undefined,
        page,
        limit: 20,
      });
      // The last page emptied by a delete: step back to the new last page.
      if (res.items.length === 0 && page > 1) {
        setPage(res.totalPages);
        return;
      }
      setData(res);
      setSelected(new Set());
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "تعذر تحميل الأكواد");
    } finally {
      setLoading(false);
    }
  }, [courseId, status, batchId, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(count);
    const p = Number(price);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      toast.error("عدد الأكواد لازم يكون من 1 لـ 500");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast.error("اكتب سعر صحيح للكود");
      return;
    }
    setGenerating(true);
    try {
      const batch = await adminCourseCodesApi.generate({
        courseId,
        count: n,
        price: p,
        label: label.trim() || undefined,
      });
      setLastBatch(batch);
      setLabel("");
      toast.success(`اتعمل ${batch.codes.length} كود`);
      setStatus("");
      setBatchId("");
      setPage(1);
      await load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "تعذر إنشاء الأكواد");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleDisabled(id: string, code: string, disable: boolean) {
    if (disable) {
      const ok = await confirm({
        title: "إيقاف الكود",
        message: `الكود ${code} مش هيشتغل لحد ما تفعّله تاني. استخدمه لو الكارت اتفقد أو مش هيتباع.`,
        confirmLabel: "إيقاف",
        tone: "danger",
      });
      if (!ok) return;
    }
    try {
      await adminCourseCodesApi.setDisabled(id, disable);
      toast.success(disable ? "تم إيقاف الكود" : "تم تفعيل الكود");
      await load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "حصل خطأ");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageItems = data?.items ?? [];
  const allSelected =
    pageItems.length > 0 && pageItems.every((item) => selected.has(item.id));

  /** Deletes codes for good, after a confirmation that says what that means. */
  async function remove(ids: string[]) {
    if (ids.length === 0 || deleting) return;
    const items = pageItems.filter((item) => ids.includes(item.id));
    const anyUsed = items.some((item) => item.status === "used");
    const single = items.length === 1 ? items[0] : null;
    const ok = await confirm({
      title: single ? "مسح الكود" : "مسح أكواد",
      message:
        (single
          ? `الكود ${single.code} هيتمسح نهائياً ومش هيشتغل تاني.`
          : `هتمسح ${ids.length.toLocaleString("ar-EG")} كود نهائياً ومش هيشتغلوا تاني.`) +
        (anyUsed
          ? single
            ? " الطالب اللي فعّله هيفضل الكورس مفتوح عنده."
            : " الطلبة اللي فعّلوا أكواد منهم هيفضل الكورس مفتوح عندهم."
          : "") +
        " مينفعش ترجّع الأكواد بعد المسح.",
      confirmLabel: "مسح نهائي",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const { deleted } = await adminCourseCodesApi.remove(ids);
      toast.success(`تم مسح ${deleted.toLocaleString("ar-EG")} كود`);
      await load();
    } catch (err) {
      toast.error(isApiError(err) ? err.message : "تعذر مسح الأكواد");
    } finally {
      setDeleting(false);
    }
  }

  const counts = data?.counts;
  const exportHref = adminCourseCodesApi.exportUrl({
    courseId,
    status: status || undefined,
    batchId: batchId || undefined,
  });

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-foreground">
            أكواد الكورس
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            اطبع أكواد وبيعها في السنتر أو المكتبة. الطالب يكتب الكود في صفحة
            الكورس فيتفتحله على طول، وكل كود بيشتغل مرة واحدة بس.
          </p>
        </div>
        {counts && (
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-600">
              متاح {counts.available.toLocaleString("ar-EG")}
            </span>
            <span className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">
              مستخدم {counts.used.toLocaleString("ar-EG")}
            </span>
            {counts.disabled > 0 && (
              <span className="rounded-lg border border-border bg-muted px-2.5 py-1 text-muted-foreground">
                متوقف {counts.disabled.toLocaleString("ar-EG")}
              </span>
            )}
          </div>
        )}
      </div>

      {!published && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
          الكورس لسه مش منشور — تقدر تعمل الأكواد دلوقتي، بس الطلبة مش هيقدروا
          يفعّلوها غير بعد ما تنشر الكورس.
        </p>
      )}

      {/* Generate a batch */}
      <form
        onSubmit={generate}
        className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto] sm:items-end"
      >
        <Field label="عدد الأكواد">
          <input
            type="number"
            min={1}
            max={500}
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="سعر الكود (ج.م)">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="وصف الدفعة" hint="اختياري">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder="مثلاً: سنتر المهندسين — شهر أكتوبر"
            className={INPUT}
          />
        </Field>
        <button
          type="submit"
          disabled={generating}
          className="min-h-11 rounded-xl bg-gradient-brand px-5 py-2 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50"
        >
          {generating ? "جارٍ الإنشاء..." : "اعمل الأكواد"}
        </button>
      </form>

      {/* The batch just made: print / export / copy right away */}
      {lastBatch && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-foreground">
            اتعمل {lastBatch.codes.length.toLocaleString("ar-EG")} كود
            {lastBatch.label ? ` — ${lastBatch.label}` : ""} بسعر{" "}
            {lastBatch.price} ج.م
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={printHref(courseId, lastBatch.batchId)}
              target="_blank"
              rel="noopener"
              className={SMALL_BTN}
            >
              🖨️ اطبعهم
            </a>
            <a
              href={adminCourseCodesApi.exportUrl({
                courseId,
                batchId: lastBatch.batchId,
              })}
              className={SMALL_BTN}
            >
              تنزيل Excel
            </a>
            <button
              type="button"
              onClick={() =>
                void copyText(lastBatch.codes.join("\n"), "اتنسخت الأكواد")
              }
              className={SMALL_BTN}
            >
              نسخ الكل
            </button>
          </div>
        </div>
      )}

      {/* Filters + bulk actions */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="دوّر بالكود أو باسم/رقم الطالب"
          className={cn(INPUT, "lg:max-w-xs")}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | CourseCodeStatus);
            setPage(1);
          }}
          className={cn(INPUT, "lg:max-w-40")}
        >
          <option value="">كل الحالات</option>
          <option value="available">متاح</option>
          <option value="used">مستخدم</option>
          <option value="disabled">متوقف</option>
        </select>
        <select
          value={batchId}
          onChange={(e) => {
            setBatchId(e.target.value);
            setPage(1);
          }}
          className={cn(INPUT, "lg:max-w-64")}
        >
          <option value="">كل الدفعات</option>
          {data?.batches.map((b) => (
            <option key={b.batchId} value={b.batchId}>
              {(b.label || dateText(b.createdAt)) +
                ` (${b.used}/${b.total} مستخدم)`}
            </option>
          ))}
        </select>
        <div className="flex gap-2 lg:mr-auto">
          <a
            href={printHref(courseId, batchId || undefined)}
            target="_blank"
            rel="noopener"
            className={SMALL_BTN}
          >
            🖨️ طباعة المتاح
          </a>
          <a href={exportHref} className={SMALL_BTN}>
            تنزيل Excel
          </a>
        </div>
      </div>

      {/* The codes */}
      {loading && !data ? (
        <LoadingScreen className="rounded-none border-0 bg-transparent py-10" />
      ) : !data || data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background py-8 text-center text-xs text-muted-foreground">
          {data && data.counts.total > 0
            ? "مفيش أكواد بالفلاتر دي."
            : "لسه مفيش أكواد للكورس ده — اعمل أول دفعة من فوق."}
        </p>
      ) : (
        <div className="space-y-2">
          {/* Select the page / act on the selection */}
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(pageItems.map((item) => item.id)),
                  )
                }
                className="size-4 accent-primary"
              />
              {selected.size > 0
                ? `تم تحديد ${selected.size.toLocaleString("ar-EG")} كود`
                : "تحديد كل أكواد الصفحة"}
            </label>
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void remove([...selected])}
                  disabled={deleting}
                  className="min-h-[34px] rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {deleting ? "جارٍ المسح..." : "مسح المحدد"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  disabled={deleting}
                  className={SMALL_BTN}
                >
                  إلغاء التحديد
                </button>
              </div>
            )}
          </div>

          <ul className={cn("space-y-2", loading && "opacity-60")}>
            {data.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-background p-3",
                  selected.has(item.id) && "border-primary/30 bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`تحديد الكود ${item.code}`}
                  className="size-4 accent-primary"
                />
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => void copyText(item.code, "اتنسخ الكود")}
                  title="نسخ الكود"
                  className="font-mono text-sm font-bold tracking-wider text-foreground hover:text-primary"
                >
                  {item.code}
                </button>
                <span
                  className={cn(
                    "rounded-lg border px-2 py-0.5 text-[11px] font-bold",
                    STATUS[item.status].className,
                  )}
                >
                  {STATUS[item.status].label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {item.price} ج.م
                  {item.batchLabel ? ` · ${item.batchLabel}` : ""}
                </span>
                <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  {item.usedBy && item.usedAt && (
                    <span>
                      استخدمه{" "}
                      <span className="font-bold text-foreground">
                        {item.usedBy.name}
                      </span>{" "}
                      <span dir="ltr">{item.usedBy.studentPhone}</span> ·{" "}
                      {dateText(item.usedAt)}
                    </span>
                  )}
                </div>
                {item.status !== "used" && (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleDisabled(
                        item.id,
                        item.code,
                        item.status === "available",
                      )
                    }
                    className={cn(
                      SMALL_BTN,
                      item.status === "available" &&
                        "border-transparent bg-red-500/10 text-red-600 hover:bg-red-500/20",
                    )}
                  >
                    {item.status === "available" ? "إيقاف" : "تفعيل"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove([item.id])}
                  disabled={deleting}
                  title="مسح الكود"
                  aria-label={`مسح الكود ${item.code}`}
                  className={cn(
                    SMALL_BTN,
                    "px-2 text-destructive hover:bg-destructive/10",
                  )}
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={SMALL_BTN}
          >
            السابق
          </button>
          <span>
            صفحة {page.toLocaleString("ar-EG")} من{" "}
            {data.totalPages.toLocaleString("ar-EG")}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className={SMALL_BTN}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
