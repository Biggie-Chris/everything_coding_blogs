import { getPublishedPosts, type Post } from "./posts";

export interface SeriesInfo {
  name: string;
  count: number;
  posts: Post[];
}

export async function getAllSeries(): Promise<SeriesInfo[]> {
  const posts = await getPublishedPosts();
  const map = new Map<string, SeriesInfo>();

  for (const post of posts) {
    if (!post.data.series) continue;
    const name = post.data.series;
    const info = map.get(name) ?? { name, count: 0, posts: [] };
    info.count++;
    info.posts.push(post);
    map.set(name, info);
  }

  for (const [, info] of map) {
    info.posts.sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export async function getSeriesByName(name: string): Promise<SeriesInfo | undefined> {
  const all = await getAllSeries();
  return all.find((s) => s.name === name);
}

export function getSeriesPosition(
  series: SeriesInfo,
  slug: string,
): { current: number; total: number } | undefined {
  const idx = series.posts.findIndex((p) => p.id === slug);
  if (idx === -1) return undefined;
  return { current: idx + 1, total: series.posts.length };
}
