import { site } from "@config/site";

export interface SeoMeta {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  pubDate?: Date;
  updatedDate?: Date;
  tags?: string[];
  noindex?: boolean;
}

export function buildPageTitle(pageTitle?: string): string {
  if (!pageTitle) return site.title;
  return `${pageTitle} | ${site.name}`;
}

export function buildCanonical(path: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  let cleanPath = path;
  if (base !== "/" && path.startsWith(base)) {
    cleanPath = path.slice(base.length) || "/";
  }
  return `${site.siteUrl}${cleanPath}`;
}

export function buildOpenGraph(meta: SeoMeta) {
  return {
    title: buildPageTitle(meta.title),
    description: meta.description ?? site.description,
    url: meta.canonical,
    siteName: site.title,
    locale: site.locale,
    type: meta.type ?? "website",
    image: meta.image ?? `${site.siteUrl}${site.seo.defaultImage}`,
    imageAlt: meta.imageAlt ?? site.description,
    pubDate: meta.pubDate?.toISOString(),
    updatedDate: meta.updatedDate?.toISOString(),
    tags: meta.tags,
  };
}

export function buildTwitterCard(meta: SeoMeta) {
  return {
    card: site.seo.twitterCard,
    title: buildPageTitle(meta.title),
    description: meta.description ?? site.description,
    image: meta.image ?? `${site.siteUrl}${site.seo.defaultImage}`,
    imageAlt: meta.imageAlt ?? site.description,
  };
}
