"use client";

import type { Stage } from "@/api/types";
import { useStudentsList } from "../StudentsListProvider";
import type { StudentStatusFilter } from "../../config/status-labels";
import {
  COMMITMENT_FILTER_LABELS,
  COMMITMENT_RULE_HINT,
  type CommitmentFilter,
} from "../../config/commitment-labels";
import { STAGE_LIST } from "@/shared/lib/stage";

const SELECT_CLASSES =
  "min-h-[44px] rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none";

export function StudentsFilters() {
  const {
    search,
    stage,
    status,
    commitment,
    setSearch,
    setStage,
    setStatus,
    setCommitment,
  } = useStudentsList();

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-4">
      <input
        type="text"
        placeholder="ابحث بالاسم أو رقم الهاتف..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="min-h-[44px] rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
        value={status}
        onChange={(e) => setStatus(e.target.value as StudentStatusFilter)}
        className={SELECT_CLASSES}
      >
        <option value="">كل الحالات</option>
        <option value="active">مفعل</option>
        <option value="pending">بانتظار التفعيل</option>
        <option value="suspended">معلق</option>
      </select>
      <select
        value={commitment}
        onChange={(e) => setCommitment(e.target.value as CommitmentFilter)}
        title={COMMITMENT_RULE_HINT}
        className={SELECT_CLASSES}
      >
        <option value="">كل مستويات الالتزام</option>
        <option value="high">{COMMITMENT_FILTER_LABELS.high}</option>
        <option value="medium">{COMMITMENT_FILTER_LABELS.medium}</option>
        <option value="low">{COMMITMENT_FILTER_LABELS.low}</option>
      </select>
    </div>
  );
}
