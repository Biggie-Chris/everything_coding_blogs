import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("读者页选中代码时保留语法颜色并显示选区背景", async () => {
  const proseStyles = await readFile(resolve(repositoryRoot, "src/styles/prose.css"), "utf8");

  assert.match(proseStyles, /\.prose \.expressive-code \*::selection/);
  assert.match(proseStyles, /background: var\(--color-selection-bg\)/);
  assert.match(proseStyles, /color: inherit/);
  assert.doesNotMatch(proseStyles, /\.expressive-code \*::selection[\s\S]*background: transparent/);
});
