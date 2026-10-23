const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "غير محدد";
  if (minutes < 60) {
    return `${toArabicDigits(Math.round(minutes))} دقيقة`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  if (rest === 0) return `${toArabicDigits(hours)} ساعة`;
  return `${toArabicDigits(hours)} ساعة و${toArabicDigits(rest)} دقيقة`;
}

export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
