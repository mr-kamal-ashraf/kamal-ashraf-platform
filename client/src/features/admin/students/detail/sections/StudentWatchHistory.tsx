"use client";

import { STAGE_LABELS } from "@/shared/lib/stage";
import { formatSeconds } from "@/shared/lib/arabic";
import { useStudentDetail } from "../StudentDetailProvider";
import { WatchHistoryCard } from "../components/WatchHistoryCard";

export function StudentWatchHistory() {
  const { data } = useStudentDetail();
  if (!data) return null;
  const { watchHistory } = data;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="text-base font-extrabold text-foreground sm:text-lg">
        سجل المشاهدة
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        الدروس اللي الطالب شافها وكام دقيقة
      </p>
      {watchHistory.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">لسه ما شافش دروس</p>
      ) : (
        <>
          <ul className="mt-4 grid gap-3 lg:hidden">
            {watchHistory.map((item) => (
              <li key={item._id}>
                <WatchHistoryCard item={item} />
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full text-right text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2">الدرس</th>
                  <th className="py-2">آخر دقيقة</th>
                  <th className="py-2">نسبة المشاهدة</th>
                  <th className="py-2">مكتمل؟</th>
                  <th className="py-2">آخر مشاهدة</th>
                </tr>
              </thead>
              <tbody>
                {watchHistory.map((item) => (
                  <tr key={item._id} className="border-b border-border/50">
                    <td className="py-2">
                      <div className="font-bold">
                        {item.lessonId?.title ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.lessonId
                          ? STAGE_LABELS[item.lessonId.stage]
                          : ""}
                      </div>
                    </td>
                    <td className="py-2 text-xs">
                      {formatSeconds(item.lastWatchedSecond)}
                    </td>
                    <td className="py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-gradient-brand"
                            style={{ width: `${item.watchedPercentage}%` }}
                          />
                        </div>
                        <span>{item.watchedPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-xs">
                      {item.isCompleted ? (
                        <span className="text-emerald-600 font-bold">
                          ✓ نعم
                        </span>
                      ) : (
                        <span className="text-muted-foreground">لا</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(item.lastWatchedAt).toLocaleDateString("ar-EG")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
