import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  type: "content",
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      pubDate: z.date(),
      updatedDate: z.date().optional(),
      tags: z.array(z.string()).default([]),
      category: z.string().optional(),
      series: z.string().optional(),
      seriesOrder: z.number().optional(),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
      cover: z.object({ src: z.string(), alt: z.string() }).optional(),
      canonicalUrl: z.string().url().optional(),
    })
    .refine(
      (data) => {
        if (data.cover && !data.cover.alt) return false;
        return true;
      },
      { message: "cover must have alt text" },
    )
    .refine(
      (data) => {
        if (data.seriesOrder !== undefined && !data.series) return false;
        return true;
      },
      { message: "seriesOrder requires series" },
    ),
});

export const collections = {
  blog: blogCollection,
};
