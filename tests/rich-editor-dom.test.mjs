import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { JSDOM } from "jsdom";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
    pretendToBeVisual: true,
    url: "https://example.test/admin/",
  });
  const { window } = dom;
  Object.assign(globalThis, {
    DOMParser: window.DOMParser,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    Range: window.Range,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: (callback) => window.setTimeout(callback, 0),
    cancelAnimationFrame: window.clearTimeout.bind(window),
    window,
    document: window.document,
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: window.navigator });
  window.DOMPurify = { sanitize: (html) => html.replace(/<script[\s\S]*?<\/script>/gi, "") };
  window.mermaid = {
    initialize() {},
    render: async (_id, chart) => ({
      svg: `<svg data-chart="${chart.replaceAll('"', "&quot;")}"></svg>`,
    }),
  };
  const revokedObjectUrls = [];
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:https://example.test/pasted-image-preview",
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: (url) => revokedObjectUrls.push(url),
  });
  window.__revokedObjectUrls = revokedObjectUrls;
  return dom;
}

test("可视化编辑器会直接挂载 Markdown、Callout、Figure 与 Mermaid 块", async () => {
  const dom = installDom();
  const sourceUrl = pathToFileURL(resolve(repositoryRoot, "src/cms-editor/rich-mdx-editor.js"));
  await import(`${sourceUrl.href}?dom-test=${Date.now()}`);
  const fixture = await readFile(resolve(repositoryRoot, "tests/fixtures/cms-preview.mdx"), "utf8");
  const source = `${fixture}\n\n\`\`\`c\nint main(void) { return 0; }\n\`\`\`\n`;
  const values = [];
  const assets = [];
  const editor = new window.MdxRichEditor({
    element: document.getElementById("mount"),
    getAsset: (path) => path,
    onAddAsset: (asset) => assets.push(asset),
    onChange: (value) => values.push(value),
    value: source,
  });

  assert.ok(document.querySelector(".rich-mdx-editor__canvas.ProseMirror"));
  const editorStyles = document.getElementById("rich-mdx-editor-styles")?.textContent || "";
  assert.match(editorStyles, /max-width:1240px/);
  assert.match(editorStyles, /overflow-x:auto!important/);
  assert.match(document.querySelector(".rich-mdx-editor__status")?.textContent || "", /实时编辑中/);
  assert.ok(document.querySelector(".rich-mdx-editor__bubble-menu"));
  assert.ok(document.querySelector(".rich-mdx-editor__drag-handle"));
  assert.ok(document.querySelector(".rich-mdx-editor__callout"));
  assert.ok(document.querySelector(".rich-mdx-editor__figure"));
  assert.equal(document.querySelector(".rich-mdx-editor__figure-controls"), null);
  assert.equal(document.querySelector(".rich-mdx-editor__figure-empty"), null);
  assert.ok(document.querySelector(".rich-mdx-editor__figure-resize"));
  const language = Array.from(document.querySelectorAll(".rich-mdx-editor__code-language")).at(-1);
  assert.equal(language?.value, "c");
  assert.ok(document.querySelector(".rich-mdx-editor__code-block span[class*='hljs-']"));
  assert.ok(
    document.querySelector(".rich-mdx-editor__mermaid"),
    JSON.stringify(editor.editor.getJSON()),
  );
  assert.equal(document.querySelector(".mdx-paste-control__preview"), null);
  assert.match(editor.editor.getText(), /RDMA/);

  document.querySelector(".rich-mdx-editor__block-add").click();
  const blockMenu = document.querySelector(".rich-mdx-editor__block-menu");
  assert.equal(blockMenu.hidden, false);
  assert.match(blockMenu.textContent, /插入内容块/);

  editor.insertCallout("tip");
  assert.match(values.at(-1), /<Callout type="tip">/);
  editor.stageImage(new window.File(["image"], "clipboard.png", { type: "image/png" }));
  assert.equal(assets.length, 1);
  assert.match(assets[0].path, /^public\/uploads\/pasted-\d+\.png$/);
  assert.match(values.at(-1), /src="\/everything_coding_blogs\/uploads\/pasted-\d+\.png"/);
  const pastedFigure = Array.from(document.querySelectorAll(".rich-mdx-editor__figure")).find(
    (figure) =>
      figure.querySelector("img")?.getAttribute("src") ===
      "blob:https://example.test/pasted-image-preview",
  );
  assert.ok(pastedFigure, "新粘贴的图片应立即使用本地预览地址显示");
  assert.equal(pastedFigure.style.width, "100%");
  assert.equal(
    pastedFigure.querySelector("img")?.getAttribute("src"),
    "blob:https://example.test/pasted-image-preview",
  );
  language.value = "python";
  language.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.match(values.at(-1), /```python/);
  assert.ok(document.querySelector(".rich-mdx-editor__code-block span[class*='hljs-']"));
  editor.destroy();
  assert.deepEqual(window.__revokedObjectUrls, ["blob:https://example.test/pasted-image-preview"]);
  dom.window.close();
});
