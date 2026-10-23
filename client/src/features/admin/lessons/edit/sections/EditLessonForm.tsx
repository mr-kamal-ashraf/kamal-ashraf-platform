"use client";

import { Field } from "../../components/Field";
import { TopicsListField } from "../../components/TopicsListField";
import { useEditLesson } from "../EditLessonProvider";

export function EditLessonForm() {
  const { lesson, courses, submitting, save, setLesson } = useEditLesson();
  if (!lesson) return null;

  return (
    <form
      onSubmit={save}
      className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
    >
      <h2 className="text-base font-extrabold sm:text-lg">بيانات الدرس</h2>

      <Field label="عنوان الدرس">
        <input
          type="text"
          value={lesson.title}
          onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
          className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Field>

      <Field
        label="رابط الدرس"
        hint="حروف إنجليزية صغيرة وشرطات فقط"
      >
        <input
          type="text"
          dir="ltr"
          value={lesson.slug}
          onChange={(e) => setLesson({ ...lesson, slug: e.target.value })}
          className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Field>

      <Field label="وصف قصير">
        <textarea
          rows={3}
          value={lesson.description}
          onChange={(e) =>
            setLesson({ ...lesson, description: e.target.value })
          }
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Field>

      <Field label="وصف تفصيلي">
        <textarea
          rows={5}
          value={lesson.longDescription}
          onChange={(e) =>
            setLesson({ ...lesson, longDescription: e.target.value })
          }
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Field label="الكورس" hint="الدرس بياخد مرحلته من الكورس">
          <select
            value={lesson.courseId}
            onChange={(e) =>
              setLesson({ ...lesson, courseId: e.target.value })
            }
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="المدة (دقيقة)">
          <input
            type="number"
            min={1}
            value={lesson.durationMinutes}
            onChange={(e) =>
              setLesson({
                ...lesson,
                durationMinutes: Number(e.target.value),
              })
            }
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>

        <Field label="عدد الفصول">
          <input
            type="number"
            min={1}
            value={lesson.chapters}
            onChange={(e) =>
              setLesson({ ...lesson, chapters: Number(e.target.value) })
            }
            className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Field>
      </div>

      <Field label="محاور الدرس" hint="دوس Enter عشان تضيف محور جديد">
        <TopicsListField
          value={lesson.topics}
          onChange={(next) => setLesson({ ...lesson, topics: next })}
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-[44px] w-full rounded-xl bg-gradient-brand px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-brand disabled:opacity-50 sm:w-auto"
      >
        {submitting ? "جارٍ الحفظ..." : "حفظ التعديلات"}
      </button>
    </form>
  );
}
