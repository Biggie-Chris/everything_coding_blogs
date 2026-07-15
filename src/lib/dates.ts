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
  const chineseCharsPerMinute = 400;
  const englishWordsPerMinute = 240;
  const codeCharsPerMinute = 200;

  const codeBlocks = [...text.matchAll(/```[\s\S]*?```/g)];
  let codeCharCount = 0;
  codeBlocks.forEach((m) => {
    codeCharCount += m[0].length;
  });

  const textWithoutCode = text.replace(/```[\s\S]*?```/g, "");

  const cleaned = textWithoutCode.replace(/^---[\s\S]*?---/g, "");

  const chineseChars = (cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;

  const asciiOnly = cleaned.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "");

  const wordText = asciiOnly.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const englishWords = wordText ? wordText.split(/\s+/).length : 0;

  const codeMinutes = codeCharCount / codeCharsPerMinute;
  const chineseMinutes = chineseChars / chineseCharsPerMinute;
  const englishMinutes = englishWords / englishWordsPerMinute;

  const totalMinutes = codeMinutes + chineseMinutes + englishMinutes;

  return Math.max(1, Math.ceil(totalMinutes));
}

export function isUpdatedRecently(pubDate: Date, updatedDate?: Date): boolean {
  if (!updatedDate) return false;
  const pubTime = pubDate.getTime();
  const updatedTime = updatedDate.getTime();
  return updatedTime > pubTime + 24 * 60 * 60 * 1000;
}
