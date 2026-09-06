import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("博客正式页面保留精简页脚、正文后的系列导航和紧凑可点击卡片", async () => {
  const [footer, postLayout, postList, postCard] = await Promise.all([
    readFile(resolve(repositoryRoot, "src/components/layout/SiteFooter.astro"), "utf8"),
    readFile(resolve(repositoryRoot, "src/layouts/PostLayout.astro"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/post/PostList.astro"), "utf8"),
    readFile(resolve(repositoryRoot, "src/components/post/PostCard.astro"), "utf8"),
  ]);

  assert.doesNotMatch(footer, /footerNav|footer-nav/);
  assert.match(footer, />RSS</);
  assert.match(footer, />GitHub</);
  assert.match(footer, /footer-copy/);

  assert.equal((postLayout.match(/<PostSeries\b/g) || []).length, 1);
  assert.ok(postLayout.indexOf("<PostSeries") > postLayout.indexOf("<Content />"));

  assert.match(postList, /align-items: start/);
  assert.match(postCard, /position: relative/);
  assert.match(postCard, /cursor: pointer/);
  assert.match(postCard, /\.post-card-title a::after/);
  assert.match(postCard, /inset: 0/);
  assert.match(postCard, /z-index: 1/);
});
