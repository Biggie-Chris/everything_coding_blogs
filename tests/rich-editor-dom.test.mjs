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
  return dom;
}

test("可视化编辑器会直接挂载 Markdown、Callout、Figure 与 Mermaid 块", async () => {
  const dom = installDom();
  const sourceUrl = pathToFileURL(resolve(repositoryRoot, "src/cms-editor/rich-mdx-editor.js"));
  await import(`${sourceUrl.href}?dom-test=${Date.now()}`);
  const source = await readFile(resolve(repositoryRoot, "tests/fixtures/cms-preview.mdx"), "utf8");
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
  assert.ok(document.querySelector(".rich-mdx-editor__callout"));
  assert.ok(document.querySelector(".rich-mdx-editor__figure"));
  assert.ok(
    document.querySelector(".rich-mdx-editor__mermaid"),
    JSON.stringify(editor.editor.getJSON()),
  );
  assert.equal(document.querySelector(".mdx-paste-control__preview"), null);
  assert.match(editor.editor.getText(), /RDMA/);

  editor.insertCallout("tip");
  assert.match(values.at(-1), /<Callout type="tip">/);
  editor.stageImage(new window.File(["image"], "clipboard.png", { type: "image/png" }));
  assert.equal(assets.length, 1);
  assert.match(assets[0].path, /^public\/uploads\/pasted-\d+\.png$/);
  assert.match(values.at(-1), /src="\/everything_coding_blogs\/uploads\/pasted-\d+\.png"/);
  editor.destroy();
  dom.window.close();
});
