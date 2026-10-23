export function PublishStatus({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
      منشور
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600">
      مسودة
    </span>
  );
}
