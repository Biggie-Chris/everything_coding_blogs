import { getPublishedPosts, type Post } from "./posts";

export interface TagInfo {
  name: string;
  count: number;
  posts: Post[];
}

export async function getAllTags(): Promise<TagInfo[]> {
  const posts = await getPublishedPosts();
  const map = new Map<string, TagInfo>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      const info = map.get(tag) ?? { name: tag, count: 0, posts: [] };
      info.count++;
      info.posts.push(post);
      map.set(tag, info);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts
    .filter((p) => p.data.tags.some((t) => t === tag))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}
