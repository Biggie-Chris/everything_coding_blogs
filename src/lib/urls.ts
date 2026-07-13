import { site } from "@config/site";

const BASE_URL = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export function siteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${normalized}`;
}

export function contentSlug(id: string): string {
  return id.replace(/\/?(index)?\.(md|mdx)$/, "");
}

export function postUrl(slug: string): string {
  return siteUrl(`/posts/${contentSlug(slug)}/`);
}

export function tagUrl(tag: string): string {
  return siteUrl(`/tags/${tagSlug(tag)}/`);
}

export function seriesUrl(series: string): string {
  return siteUrl(`/series/${tagSlug(series)}/`);
}

export function tagSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^\w一-鿿㐀-䶿-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function externalUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${site.siteUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

export function githubEditUrl(id: string): string {
  return `${site.githubUrl}/tree/main/src/content/blog/${contentSlug(id)}/index.md`;
}
