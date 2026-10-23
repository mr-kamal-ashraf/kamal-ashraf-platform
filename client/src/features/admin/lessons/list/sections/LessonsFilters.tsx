"use client";

import type { Stage } from "@/api/types";
import {
  useLessonsList,
  type PublishedFilter,
} from "../LessonsListProvider";
import { STAGE_LIST } from "@/shared/lib/stage";

const SELECT_CLASSES =
  "min-h-[44px] rounded-xl border border-border bg-card px-4 py-2.5 text-sm sm:w-auto";

export function LessonsFilters() {
  const { search, stage, published, setSearch, setStage, setPublished } =
    useLessonsList();

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ابحث باسم الدرس..."
        className={`${SELECT_CLASSES} sm:min-w-64`}
      />
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value as "" | Stage)}
        className={SELECT_CLASSES}
      >
        <option value="">كل المراحل</option>
        {STAGE_LIST.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={published}
        onChange={(e) => setPublished(e.target.value as PublishedFilter)}
        className={SELECT_CLASSES}
      >
        <option value="">كل الدروس</option>
        <option value="true">منشور</option>
        <option value="false">مسودة</option>
      </select>
    </div>
  );
}
