"use client";

import Link from "next/link";
import { Field } from "../../components/Field";
import { FormSection } from "../../components/FormSection";
import { TopicsListField } from "../../components/TopicsListField";
import { useNewLesson } from "../NewLessonProvider";

/**
 * The lesson's text fields, split across two wizard steps via `group`:
 *   - "course"  → course picker, title, slug
 *   - "details" → short/long description, duration, chapters, topics
 */
export function NewLessonBasicFields({
  group,
}: {
  group: "course" | "details";
}) {
  const { form, setForm, courses, errors } = useNewLesson();

  if (group === "course") {
    return (
      <FormSection title="الكورس والعنوان">
        <Field
          label="الكورس"
          hint="الدرس هيتضاف جوا الكورس ده وياخد مرحلته"
          error={errors.courseId}
        >
          {courses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background px-3 py-3 text-xs text-muted-foreground">
              لسه مفيش كورسات.{" "}
              <Link
                href="/admin/courses/new"
                className="font-bold text-primary underline"
              >
                أنشئ كورس الأول
              </Link>{" "}
              عشان تقدر تضيف دروس.
            </div>
          ) : (
            <select
              value={form.courseId}
              onChange={(e) =>
                setForm((p) => ({ ...p, courseId: e.target.value }))
              }
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="عنوان الدرس" error={errors.title}>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="مثال: مراجعة نهائية على الوراثة"
          />
        </Field>

        <Field
          label="رابط الدرس"
          hint="حروف إنجليزية صغيرة وشرطات بدل المسافات"
          error={errors.slug}
        >
          <input
            type="text"
            dir="ltr"
            value={form.slug}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
              }))
            }
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="nahw-final-review"
          />
        </Field>
      </FormSection>
    );
  }

  return (
    <FormSection title="وصف الدرس وتفاصيله">
      <Field
        label="وصف قصير"
        hint="يظهر في كارت الدرس داخل الكورس"
        error={errors.description}
      >
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) =>
            setForm((p) => ({ ...p, description: e.target.value }))
          }
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="جملة أو جملتين تشرح الدرس باختصار"
        />
      </Field>

      <Field label="وصف تفصيلي" hint="يظهر في صفحة الدرس" error={errors.longDescription}>
        <textarea
          rows={5}
          value={form.longDescription}
          onChange={(e) =>
            setForm((p) => ({ ...p, longDescription: e.target.value }))
          }
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="اشرح للطالب محتوى الدرس وأهدافه التعليمية"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="مدة الدرس (دقيقة)" error={errors.durationMinutes}>
          <input
            type="number"
            min={1}
            value={form.durationMinutes}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                durationMinutes: Number(e.target.value),
              }))
            }
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        <Field label="عدد الفصول" error={errors.chapters}>
          <input
            type="number"
            min={1}
            value={form.chapters}
            onChange={(e) =>
              setForm((p) => ({ ...p, chapters: Number(e.target.value) }))
            }
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
      </div>

      <Field
        label="محاور الدرس"
        hint="اختياري — دوس Enter عشان تضيف محور جديد"
        error={errors.topics}
      >
        <TopicsListField
          value={form.topics}
          onChange={(next) => setForm((p) => ({ ...p, topics: next }))}
        />
      </Field>
    </FormSection>
  );
}
