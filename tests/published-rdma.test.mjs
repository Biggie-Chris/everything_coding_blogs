import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("现有公开文章可携带与文章目录同级的图片资源", async () => {
  const articlePath = resolve(repositoryRoot, "src/content/blog/understanding-epoll/index.mdx");
  const [article] = await Promise.all([
    readFile(articlePath, "utf8"),
    stat(resolve(repositoryRoot, "src/content/blog/understanding-epoll/epoll-architecture.svg")),
  ]);

  assert.match(article, /^draft: false$/m);
  assert.match(article, /!\[epoll 内部架构\]\(\.\/epoll-architecture\.svg\)/);
});
