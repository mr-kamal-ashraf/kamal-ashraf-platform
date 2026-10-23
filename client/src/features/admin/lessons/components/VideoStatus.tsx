export function VideoStatus({ uploaded }: { uploaded: boolean }) {
  return uploaded ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
      ✓ فيديو مرفوع
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
      مفيش فيديو
    </span>
  );
}
