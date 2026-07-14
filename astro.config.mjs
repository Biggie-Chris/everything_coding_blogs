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
      // 站点主题切换使用 <html data-theme="dark|light">（system 模式时无该属性，
      // 由 prefers-color-scheme 媒体查询决定）。把 EC 的主题名重命名为 dark/light，
      // 使其默认生成的 [data-theme='...'] 选择器与 prefers-color-scheme 媒体查询
      // 直接对齐站点主题，避免暗色模式下代码块仍显示亮色背景。
      customizeTheme: (theme) => {
        if (theme.name === "github-dark") theme.name = "dark";
        else if (theme.name === "github-light") theme.name = "light";
      },
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
