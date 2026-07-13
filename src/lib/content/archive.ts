import { getPublishedPosts, type Post } from "./posts";
import { getMonthKey, getMonthLabel, getYear } from "../dates";

export interface ArchiveMonth {
  key: string;
  label: string;
  posts: Post[];
}

export interface ArchiveYear {
  year: number;
  months: ArchiveMonth[];
}

export async function getArchive(): Promise<ArchiveYear[]> {
  const posts = await getPublishedPosts();
  const yearMap = new Map<number, Map<string, Post[]>>();

  for (const post of posts) {
    const year = getYear(post.data.pubDate);
    const monthKey = getMonthKey(post.data.pubDate);

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const monthMap = yearMap.get(year)!;
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
    monthMap.get(monthKey)!.push(post);
  }

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, posts]) => ({
          key,
          label: getMonthLabel(key),
          posts: posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()),
        })),
    }));
}
