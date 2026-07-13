import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;

export type PostWithBody = Post & { body: string };

export async function getAllPosts(): Promise<Post[]> {
  return getCollection("blog", ({ data }) => {
    if (import.meta.env.PROD && data.draft) return false;
    return true;
  });
}

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export async function getFeaturedPosts(): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((p) => p.data.featured);
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const posts = await getAllPosts();
  return posts.find(
    (p) => p.id === slug || p.id === `${slug}/index.md` || p.id === `${slug}/index.mdx`,
  );
}

export async function getPostWithPrevNext(
  slug: string,
): Promise<{ post: Post; prev: Post | null; next: Post | null } | undefined> {
  const posts = await getPublishedPosts();
  const idx = posts.findIndex(
    (p) => p.id === slug || p.id === `${slug}/index.md` || p.id === `${slug}/index.mdx`,
  );
  if (idx === -1) return undefined;
  return {
    post: posts[idx]!,
    prev: idx < posts.length - 1 ? posts[idx + 1]! : null,
    next: idx > 0 ? posts[idx - 1]! : null,
  };
}

export async function getRelatedPosts(post: Post, limit = 3): Promise<Post[]> {
  const posts = await getPublishedPosts();
  const others = posts.filter((p) => p.id !== post.id);
  const scored = others.map((p) => {
    let score = 0;
    const sharedTags = p.data.tags.filter((t) => post.data.tags.includes(t));
    score += sharedTags.length * 3;
    if (p.data.category && p.data.category === post.data.category) score += 2;
    if (p.data.series && p.data.series === post.data.series) score += 1;
    return { post: p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.post);
}
