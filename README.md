# CHRIS'S BLOGS

基于 [Astro](https://astro.build) 构建的个人技术博客，专注于 Linux 高性能网络、RDMA、AI Infra 与系统编程。

## 技术栈

| 类别     | 技术                          |
| -------- | ----------------------------- |
| 框架     | Astro (static generation)     |
| 语言     | TypeScript (strict mode)      |
| 内容     | Markdown + MDX                |
| 代码高亮 | Expressive Code               |
| 搜索     | Pagefind (static)             |
| 样式     | CSS (variables, no framework) |
| 包管理   | pnpm                          |
| 部署     | GitHub Pages                  |

## 环境要求

- Node.js 20+
- pnpm 10+

## 安装

```bash
pnpm install
```

## 本地开发

```bash
pnpm dev
```

开发环境会显示草稿文章（带草稿标识）。热重载默认启用。

## 构建

```bash
pnpm build
```

构建流程：`astro check` → `astro build` → `pagefind --site dist`

## 预览生产构建

```bash
pnpm preview
```

## 部署到 GitHub Pages

### 首次设置

1. 在 GitHub 仓库 Settings → Pages 中：
   - Source: **GitHub Actions**
2. 推送代码到 `main` 分支，GitHub Actions 会自动部署。
3. 部署完成后访问 `https://YOUR_GITHUB_USERNAME.github.io`。

### 自定义域名

1. 在 `src/config/site.ts` 中将 `siteUrl` 修改为你的域名。
2. 在 `public/` 目录下创建 `CNAME` 文件，写入你的域名。
3. 部署后 GitHub Pages 会自动配置。

### 非根路径仓库

如果仓库名不是 `USERNAME.github.io`，需要设置 `base` 路径：

1. 在 `astro.config.mjs` 中设置 `base: "/repo-name/"`。
2. 所有内部链接通过 `import.meta.env.BASE_URL` 已兼容。

## 站点配置

修改 `src/config/site.ts`：

```ts
export const site = {
  name: "YOUR_NAME",
  title: "YOUR_NAME 的技术博客",
  siteUrl: "https://YOUR_GITHUB_USERNAME.github.io",
  // ...
};
```

导航在 `src/config/navigation.ts`，功能开关在 `src/config/features.ts`。

## 创建文章

在 `src/content/blog/` 下创建新目录，放入 `index.md` 或 `index.mdx`：

```text
src/content/blog/my-new-post/
├── index.md
└── architecture.svg
```

### Frontmatter 模板

```yaml
---
title: "文章标题"
description: "文章描述"
pubDate: 2026-01-01
updatedDate: # 可选
tags: ["Linux", "网络编程"]
category: "网络编程" # 可选
series: "Linux 网络编程深入" # 可选
seriesOrder: 1 # 可选，需配合 series
draft: false # 草稿不会出现在生产构建中
featured: false # 精选文章显示在首页
cover: # 可选
  src: ./cover.png
  alt: "封面图片描述"
---
```

### 本地图片

```markdown
![架构图](./architecture.svg)
```

图片放在文章同目录，使用相对路径引用。

### 代码块高级标记

````markdown
```c title="server.c" {3-7}
// 高亮第 3-7 行
```

```diff
- 删除行
+ 新增行
```

```txt title="Terminal"
$ echo "终端风格"
```
````

### 系列文章

1. 在每篇文章 frontmatter 中设置相同的 `series` 值。
2. 使用 `seriesOrder` 控制顺序。

### 标签

在 frontmatter 的 `tags` 数组中添加标签，支持中文。

## 扩展功能

### 启用 Giscus 评论

1. `src/config/features.ts` 中设置 `comments: true`。
2. 在 `src/components/comments/` 创建 `GiscusComments.astro`。
3. 在 `PostLayout.astro` 中引入评论组件。

### 启用 Analytics

1. `src/config/features.ts` 中设置 `analytics: true`。
2. 在 `src/components/analytics/` 创建对应 provider 组件。
3. 在 `BaseLayout.astro` 中引入。

### 启用 Mermaid

1. 安装 `mermaid` 和对应的 Astro 集成。
2. `src/config/features.ts` 中设置 `mermaid: true`。
3. 仅在需要 Mermaid 的页面加载脚本，避免全局 bundle。

## Lint 和格式化

```bash
pnpm check       # TypeScript 类型检查
pnpm format      # Prettier 格式化
pnpm format:check # 检查格式
```

## 目录结构

```
src/
├── components/    # UI 组件
│   ├── layout/    # 布局组件
│   ├── post/      # 文章相关组件
│   ├── search/    # 搜索组件 (Pagefind)
│   └── seo/       # SEO 组件
├── config/        # 配置文件
├── content/       # 文章内容 (Content Collections)
├── layouts/       # 页面布局
├── lib/           # 业务逻辑
│   ├── content/   # 文章查询、标签、系列
│   └── seo/       # SEO 相关逻辑
├── pages/         # 路由页面
└── styles/        # CSS
```

## 常见问题

### 搜索在开发环境不工作

搜索依赖 Pagefind 索引，只在 `pnpm build` 后生成。开发环境使用 `pnpm dev` 时搜索提示"索引不可用"是正常的。

### 中文标签 URL 异常

标签 URL 使用稳定的 slug 处理，中文标签会被转换为 slug。确保不依赖大小写敏感匹配。

### 构建后页面路径错误

确认 `astro.config.mjs` 中的 `site` 和 `base` 与 GitHub Pages 设置一致。
