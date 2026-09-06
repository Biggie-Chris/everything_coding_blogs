import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { editorJsonToMdx, mdxToEditorHtml } from "../src/cms-editor/mdx-format.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adminDirectory = resolve(repositoryRoot, "public/admin");

test("现有 Markdown / MDX 会转换为可视化块，同时保留未知 JSX", async () => {
  const fixture = await readFile(resolve(repositoryRoot, "tests/fixtures/cms-preview.mdx"), "utf8");
  const html = mdxToEditorHtml(fixture);

  assert.match(html, /<h2>RDMA 快速入门<\/h2>/);
  assert.match(html, /data-mdx-callout="true"/);
  assert.match(html, /data-mdx-figure="true"/);
  assert.match(html, /data-mdx-mermaid="true"/);

  const unknown = mdxToEditorHtml('import Demo from "./Demo.astro";\n\n<Demo enabled={true} />');
  assert.match(unknown, /data-mdx-raw="true"/);
});

test("编辑器序列化会生成 Astro 可发布的 MDX 和公共图片路径", () => {
  const output = editorJsonToMdx({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "图文说明" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "这里有" },
          { type: "text", text: "重点", marks: [{ type: "bold" }] },
        ],
      },
      {
        type: "callout",
        attrs: { type: "warning" },
        content: [{ type: "paragraph", content: [{ type: "text", text: "请先确认配置。" }] }],
      },
      {
        type: "figure",
        attrs: {
          src: "/everything_coding_blogs/uploads/pasted-example.png",
          alt: "上传图片",
          caption: "粘贴后随文章提交",
        },
      },
      { type: "mermaid", attrs: { chart: "flowchart LR\n  A --> B" } },
      { type: "rawMdx", attrs: { source: "<Demo enabled={true} />" } },
    ],
  });

  assert.match(output, /import Callout from "@components\/post\/Callout\.astro";/);
  assert.match(output, /import Figure from "@components\/post\/Figure\.astro";/);
  assert.match(output, /import Mermaid from "@components\/post\/Mermaid\.astro";/);
  assert.match(output, /<Callout type="warning">/);
  assert.match(output, /<Figure\n  src="\/everything_coding_blogs\/uploads\/pasted-example\.png"/);
  assert.match(output, /<Mermaid chart=\{`flowchart LR/);
  assert.match(output, /<Demo enabled=\{true\} \/>/);
  assert.doesNotMatch(output, /\.\.\/uploads\/pasted-/);
});

test("CMS 只加载本地打包的可视化编辑器，图片使用 public 目录", async () => {
  const [config, indexHtml, widget, bundle] = await Promise.all([
    readFile(resolve(adminDirectory, "config.yml"), "utf8"),
    readFile(resolve(adminDirectory, "index.html"), "utf8"),
    readFile(resolve(adminDirectory, "paste-image.js"), "utf8"),
    readFile(resolve(adminDirectory, "vendor/rich-mdx-editor.js"), "utf8"),
  ]);

  assert.match(config, /^media_folder: public\/uploads$/m);
  assert.match(config, /^public_folder: \/everything_coding_blogs\/uploads$/m);
  assert.ok(
    indexHtml.indexOf("./vendor/mermaid.min.js") < indexHtml.indexOf("./vendor/rich-mdx-editor.js"),
  );
  assert.ok(
    indexHtml.indexOf("./vendor/rich-mdx-editor.js") < indexHtml.indexOf("./paste-image.js"),
  );
  assert.match(widget, /new window\.MdxRichEditor/);
  assert.doesNotMatch(widget, /textarea/);
  assert.match(bundle, /MdxRichEditor/);
  await stat(resolve(adminDirectory, "vendor/marked.umd.js"));
  await stat(resolve(adminDirectory, "vendor/purify.min.js"));
  await stat(resolve(adminDirectory, "vendor/mermaid.min.js"));
});
