import rss from "@astrojs/rss";
import { getPublishedPosts } from "@lib/content/posts";
import { site } from "@config/site";
import { postUrl } from "@lib/urls";

export async function GET() {
  const posts = await getPublishedPosts();

  return rss({
    title: site.title,
    description: site.description,
    site: site.siteUrl,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post.id),
      categories: post.data.tags,
      author: site.author,
    })),
    customData: `<language>${site.language}</language>`,
  });
}
