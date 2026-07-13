export const features = {
  search: true,
  rss: true,
  sitemap: true,
  tableOfContents: true,
  readingProgress: true,
  comments: false,
  analytics: false,
  mermaid: false,
} as const;

export type Features = typeof features;
export type FeatureKey = keyof Features;
