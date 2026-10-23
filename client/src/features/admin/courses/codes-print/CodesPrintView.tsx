"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  adminCourseCodesApi,
  isApiError,
  type CourseCodeItem,
  type CourseCodeStatus,
} from "@/api";
import { SITE } from "@/shared/i18n/site";

/**
 * A print sheet of course-code cards to cut out and sell: each card carries
 * the platform, the course, the code in large type and how to redeem it.
 * Opened from أكواد الكورس with ?courseId=&batchId=&status=available.
 */
export function CodesPrintView() {
  const params = useSearchParams();
  const courseId = params.get("courseId") ?? "";
  const batchId = params.get("batchId") ?? undefined;
  const status = (params.get("status") as CourseCodeStatus | null) ?? undefined;

  const [title, setTitle] = useState("");
  const [items, setItems] = useState<CourseCodeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [host, setHost] = useState("");

  useEffect(() => {
    setHost(window.location.host);
    if (!courseId) {
      setError("الرابط ناقص — افتح الطباعة من صفحة الكورس.");
      return;
    }
    adminCourseCodesApi
      .printData({ courseId, batchId, status })
      .then((data) => {
        setTitle(data.courseTitle);
        setItems(data.items);
      })
      .catch((err) =>
        setError(isApiError(err) ? err.message : "تعذر تحميل الأكواد"),
      );
  }, [courseId, batchId, status]);

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <style>{"@page { size: A4; margin: 10mm; }"}</style>

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 print:hidden">
        <div>
          <p className="text-sm font-extrabold text-foreground">
            طباعة أكواد: {title || "…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {items
              ? `${items.length.toLocaleString("ar-EG")} كارت`
              : "جارٍ التحميل..."}{" "}
            — قص على الخط المتقطع.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={courseId ? `/admin/courses/${courseId}` : "/admin/courses"}
            className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-muted"
          >
            رجوع
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!items || items.length === 0}
            className="min-h-10 rounded-xl bg-gradient-brand px-5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50"
          >
            🖨️ اطبع
          </button>
        </div>
      </div>

      {error ? (
        <p className="p-10 text-center text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : items && items.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          مفيش أكواد متاحة للطباعة بالفلاتر دي.
        </p>
      ) : (
        <div className="mx-auto grid max-w-[210mm] grid-cols-2 gap-0 p-4 sm:grid-cols-3 print:max-w-none print:grid-cols-3 print:p-0">
          {items?.map((item) => (
            <div
              key={item.id}
              className="flex break-inside-avoid flex-col items-center gap-1.5 border border-dashed border-foreground/40 bg-white px-3 py-4 text-center text-black"
            >
              <p className="text-[10px] font-bold text-neutral-500">
                {SITE.brand}
              </p>
              <p className="line-clamp-2 text-xs font-extrabold leading-snug">
                {title}
              </p>
              <p
                dir="ltr"
                className="my-1 rounded-md border border-neutral-300 px-2 py-1 font-mono text-base font-bold tracking-widest"
              >
                {item.code}
              </p>
              <p className="text-[9px] leading-relaxed text-neutral-600">
                ادخل على{" "}
                <span dir="ltr" className="font-bold">
                  {host}
                </span>{" "}
                وسجّل دخول، افتح صفحة الكورس واختار «عندك كود؟» واكتب الكود.
              </p>
              <p className="text-[9px] font-bold text-neutral-500">
                الكود يستخدم مرة واحدة فقط
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
