# 项目协作与发布约定

## Git 提交与推送

1. 每次创建提交前，先同步远端：`git pull --ff-only origin main`。
2. 若远端在本地已有提交后更新，先执行 `git fetch origin main`，再用
   `git rebase origin/main` 整合；不得使用强制推送、`git reset --hard` 或覆盖远端内容。
3. 提交前必须通过 `git diff --check`、`pnpm test` 和 `pnpm build`。若同步远端带来了
   内容或代码变更，需要重新执行相关验证。
4. 提交只包含本次任务需要的源代码、内容和测试；不要提交 `dist/`、
   `public/admin/vendor/` 等构建产物。
5. 推送目标为 `origin main`，GitHub Actions 会自动部署 GitHub Pages。CMS 发布文章也会
   直接在 `main` 创建提交，因此提交前同步远端是必要步骤。

## CMS 与文章内容

- 文章统一位于 `src/content/blog/<slug>/index.mdx`。普通 Markdown 是合法 MDX，不要为同一篇
  文章再创建 `.md` 副本。
- CMS 配置位于 `public/admin/config.yml`；Cloudflare Worker 的 OAuth 地址可配置，但不得把
  OAuth client secret、访问令牌或其他密钥写入仓库。
- 后台正文使用可视化 MDX 编辑器，源码在 `src/cms-editor/`。修改后让
  `scripts/sync-cms-vendors.mjs` 生成后台浏览器包；不要手改或跟踪
  `public/admin/vendor/`。
- 粘贴或选择图片必须通过 CMS 的 `onAddAsset` 写入 `public/uploads/`，文章中保存的地址使用
  `/everything_coding_blogs/uploads/<filename>`。不要写 `../uploads/...`，否则 Astro 会在构建时
  把它当作相对模块解析并失败。
- 编辑期间粘贴图片会用 Blob URL 作即时预览；这是临时地址，不能序列化到 MDX。Publish 时保存的
  必须仍是公共图片路径。图片宽度会写入 `Figure` 的 `width` 属性并在读者页面保持一致。
- CMS 删除文章会直接生成远端提交。测试、页面路由或系列数据若仍依赖该文章，应调整对应逻辑或测试，
  不要在未获要求时恢复已删除文章。

## 读者页面与交互

- `/admin/` 是作者入口，普通博客导航和页脚不得新增写作或管理入口。
- 文章卡片应保持整卡可点击、同一网格行按内容自然高度显示，避免因封面图片拉伸无图卡片。
- 系列导航只在文章正文结束后显示；页脚只保留 RSS、GitHub 和作者署名。
- Callout、Figure、Mermaid 和不同语言代码块的 CMS 编辑体验必须同时保证 MDX 序列化和 Astro
  静态构建可用。

## 本地文档与测试

- 测试放在根目录 `tests/`，对新增交互或已修复回归补充针对性测试。
- `chris_docs/` 是本地技术记录目录，按用户要求保持 Git 忽略，不能纳入提交。
- `reference-repos/` 仅用于参考开源项目，也保持 Git 忽略；不要复制其代码或许可证文本到本项目。
