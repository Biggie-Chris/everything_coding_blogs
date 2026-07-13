import { site } from "@config/site";
import type { Post } from "@lib/content/posts";
import { postUrl } from "@lib/urls";

export function personSchema() {
  return {
    "@type": "Person",
    name: site.author,
    url: site.siteUrl,
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    name: site.title,
    description: site.description,
    url: site.siteUrl,
    inLanguage: site.language,
    author: { "@id": `${site.siteUrl}/#person` },
  };
}

export function blogPostingSchema(post: Post) {
  const url = postUrl(post.id);
  return {
    "@type": "BlogPosting",
    headline: post.data.title,
    description: post.data.description,
    datePublished: post.data.pubDate.toISOString(),
    dateModified: (post.data.updatedDate ?? post.data.pubDate).toISOString(),
    url,
    author: { "@id": `${site.siteUrl}/#person` },
    inLanguage: site.language,
    keywords: post.data.tags.join(", "),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

export function buildStructuredData(items: Record<string, unknown>[]): string {
  const graph = items.map((item) => ({
    ...item,
    "@context": undefined,
  }));
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}
