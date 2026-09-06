import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("RDMA 文章是公开内容，并为列表页提供公共封面", async () => {
  const articlePath = resolve(repositoryRoot, "src/content/blog/rdma-verbs-introduction/index.mdx");
  const [article] = await Promise.all([
    readFile(articlePath, "utf8"),
    stat(resolve(repositoryRoot, "public/uploads/rdma-stack.svg")),
  ]);

  assert.match(article, /^draft: false$/m);
  assert.match(article, /^  src: \/everything_coding_blogs\/uploads\/rdma-stack\.svg$/m);
});
