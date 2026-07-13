export function formatDate(date: Date, locale = "zh-CN"): string {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateLong(date: Date, locale = "zh-CN"): string {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateISO(date: Date): string {
  return date.toISOString();
}

export function getYear(date: Date): number {
  return date.getFullYear();
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthLabel(key: string, locale = "zh-CN"): string {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(locale, { year: "numeric", month: "long" });
}

export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 300;
  const cleaned = text.replace(/```[\s\S]*?```/g, "").replace(/[#*[\]()>|`]/g, "");
  const charCount = cleaned.length;
  const minutes = Math.ceil(charCount / wordsPerMinute);
  return Math.max(1, minutes);
}

export function isUpdatedRecently(pubDate: Date, updatedDate?: Date): boolean {
  if (!updatedDate) return false;
  const pubTime = pubDate.getTime();
  const updatedTime = updatedDate.getTime();
  return updatedTime > pubTime + 24 * 60 * 60 * 1000;
}
