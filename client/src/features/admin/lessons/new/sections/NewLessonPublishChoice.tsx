"use client";

import { Panel } from "@/features/admin/shared/form/Panel";
import { useNewLesson, type PublishChoice } from "../NewLessonProvider";

const CHOICES: Array<{ value: PublishChoice; title: string; text: string }> = [
  {
    value: "whenReady",
    title: "انشره للطلاب أول ما الفيديو يجهز",
    text: "مش محتاج ترجع تاني — بعد الرفع الفيديو بيتجهز كام دقيقة، وبعدها الدرس بيتنشر لوحده.",
  },
  {
    value: "draft",
    title: "احفظه مخفي دلوقتي",
    text: "الدرس يفضل مسودة لحد ما تنشره بنفسك من صفحة الكورس.",
  },
];

/** What happens once the video is up — decided now, so there's no coming back for it. */
export function NewLessonPublishChoice() {
  const { publishChoice, setPublishChoice, courses, courseId } = useNewLesson();
  const course = courses?.find((c) => c._id === courseId);

  return (
    <Panel title="بعد الرفع">
      <div role="radiogroup" aria-label="بعد الرفع" className="grid gap-3 sm:grid-cols-2">
        {CHOICES.map((choice) => (
          <label
            key={choice.value}
            className="flex cursor-pointer gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
          >
            <input
              type="radio"
              name="publishChoice"
              value={choice.value}
              checked={publishChoice === choice.value}
              onChange={() => setPublishChoice(choice.value)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block text-sm font-extrabold text-foreground">{choice.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {choice.text}
              </span>
            </span>
          </label>
        ))}
      </div>
      {course && !course.isPublished && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
          الكورس نفسه لسه مخفي — الطلاب هيشوفوا الدروس لما تنشر الكورس من صفحته.
        </p>
      )}
    </Panel>
  );
}
