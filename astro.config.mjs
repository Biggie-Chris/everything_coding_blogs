import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import expressiveCode from "astro-expressive-code";

import { site } from "./src/config/site";

export default defineConfig({
  site: site.siteUrl,
  base: "/everything_coding_blogs/",
  output: "static",
  trailingSlash: "always",
  integrations: [
    expressiveCode({
      themes: ["github-dark", "github-light"],
      styleOverrides: {
        borderRadius: "0.375rem",
        codeFontFamily:
          "var(--font-mono, 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace)",
        codeFontSize: "0.875rem",
        codeLineHeight: "1.65",
        frames: {
          frameBoxShadowCssValue: "none",
        },
      },
      defaultProps: {
        wrap: false,
        showLineNumbers: true,
      },
    }),
    mdx(),
    sitemap(),
  ],
  markdown: {
    gfm: true,
    footnotes: true,
  },
  prefetch: false,
  vite: {
    resolve: {
      alias: {
        "@config": "/src/config",
        "@components": "/src/components",
        "@layouts": "/src/layouts",
        "@lib": "/src/lib",
        "@assets": "/src/assets",
      },
    },
  },
});
