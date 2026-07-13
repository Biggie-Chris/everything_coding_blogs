# CLAUDE.md

技术博客项目，使用 Astro 静态生成，部署到 GitHub Pages。

## 项目目标

个人技术博客，内容覆盖 Linux 网络编程、RDMA、eBPF、AI Infra、C/C++、分布式系统、系统性能分析。

## 技术栈

- **框架**: Astro 5 (static generation, `output: "static"`)
- **语言**: TypeScript strict mode
- **内容**: Markdown + MDX (Content Collections)
- **代码高亮**: Expressive Code
- **搜索**: Pagefind (纯静态，构建时索引)
- **样式**: 原生 CSS + CSS Variables
- **包管理**: pnpm
- **部署**: GitHub Pages via Actions

## 禁止引入的技术

- React / Vue / Svelte
- Tailwind CSS
- 数据库 / CMS / API Routes
- 大型 UI 组件库
- Moment.js / Lodash
- 客户端 Markdown 解析
- 图标字体

## 目录职责

```
src/
├── components/    # 纯展示组件，不查询数据
│   ├── layout/    # SiteHeader, SiteFooter, ThemeToggle, MobileNavigation
│   ├── post/      # PostCard, PostList, PostMeta, PostTags, PostSeries, TOC, etc.
│   ├── search/    # SearchButton, SearchDialog (HTML only, JS in public/js/)
│   └── seo/       # SeoHead (统一 meta/schema)
├── config/        # site.ts, navigation.ts, features.ts (集中配置)
├── content/blog/  # Markdown/MDX 文章 (每篇一个目录)
├── layouts/       # BaseLayout, PageLayout, PostLayout
├── lib/           # 数据查询和业务逻辑
│   ├── content/   # posts.ts, tags.ts, series.ts, archive.ts, related.ts
│   ├── seo/       # metadata.ts, structured-data.ts
│   ├── urls.ts    # URL 生成, slug 处理
│   └── dates.ts   # 日期格式化, 阅读时间
├── pages/         # 路由页面 (index, posts, tags, series, archive, search, about, 404, rss, robots)
└── styles/        # tokens.css, reset.css, global.css, typography.css, prose.css, utilities.css
```

## 架构边界

### 内容 → 查询 → 展示

- 文章查询、排序、聚合逻辑集中在 `src/lib/content/` 中
- 页面组件负责组合布局和数据
- 展示组件只接收 Props，不查询数据
- **禁止在页面组件中重复实现过滤/排序/聚合逻辑**

### 集中配置

- `src/config/site.ts` — 站点名称、URL、SEO 默认值
- `src/config/navigation.ts` — 导航菜单
- `src/config/features.ts` — 功能开关 (search, rss, toc, comments, analytics, mermaid)
- **不允许硬编码 site URL**
- **环境变量通过配置模块统一解析，不在页面中直接读取**

### Content Collections

Schema 位于 `src/content.config.ts`。约束：

- `title` 和 `description` 必填
- `tags` 默认为空数组
- `draft: true` 在生产构建中不生成页面
- `cover` 必须有 `coverAlt`
- `seriesOrder` 需要 `series`

### 文章目录 ID

每篇文章使用目录名作为稳定 ID。例如：

- `src/content/blog/understanding-epoll/index.md` → slug: `understanding-epoll`
- URL: `/posts/understanding-epoll/`

## 新增文章

1. 在 `src/content/blog/` 下创建新目录 (目录名 = slug)。
2. 创建 `index.md` 或 `index.mdx`。
3. 填写 frontmatter (参考模板)。
4. 图片放在同目录，使用相对路径引用。
5. MDX 文章可以导入 Callout/Figure 组件。

默认使用 `.md`；仅在需要自定义组件时使用 `.mdx`。

## 新增页面

1. 在 `src/pages/` 创建 `.astro` 页面。
2. 使用 `PageLayout` 或 `PostLayout` 作为 wrapper。
3. 传递完整的 `SeoMeta` 信息。

## 新增功能

1. 在 `src/config/features.ts` 添加开关。
2. 在对应扩展目录 (`src/components/{comments,analytics}/`) 创建组件。
3. 在合适的 Layout 组件中引入。
4. 更新 README 的扩展说明。

## CSS 规范

- 使用 CSS Variables (`src/styles/tokens.css`)
- 所有颜色使用语义变量 (`--color-bg`, `--color-text`, `--color-accent` 等)
- 不要在组件中散落 hex 颜色
- 正文宽度: `--prose-width: 740px`
- 页面宽度: `--page-width: 1200px`
- 深色主题通过 `[data-theme="dark"]` 选择器
- 尊重 `prefers-reduced-motion` 和 `prefers-color-scheme`

## TypeScript 规范

- strict mode
- 组件 Props 必须定义 TypeScript 接口
- 避免使用 `any` (除非有明确注释)
- 工具函数明确输入输出类型

## 构建验证

每次修改后必须执行：

```bash
pnpm check       # 类型检查
pnpm build       # 完整构建 (check + build + pagefind)
pnpm format:check # 格式检查
```

**如果任何命令失败，必须在结束任务前修复。**
**不要通过删除功能绕过错误。**
**不要使用 `@ts-ignore` 隐藏类型问题。**

## GitHub Pages 注意事项

- 站点部署在根路径 (USERNAME.github.io)
- 所有内部链接使用 `import.meta.env.BASE_URL` 兼容
- 外部 URL 通过 `src/config/site.ts` 生成
- `trailingSlash: "always"` 保证每个页面生成 `/index.html`

## 不允许的操作

- 不硬编码 site URL
- 不自动修改文章技术结论
- 不删除已有 Git 历史
- 不自动执行 `git push`
- 不自动创建远程仓库
- 不提交 `dist/`, `.astro/`, `node_modules/`
- 不创建未使用的 index barrel 文件
- 不创建无法运行的占位代码
