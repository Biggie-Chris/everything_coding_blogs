import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { JSDOM, ResourceLoader } from "jsdom";

const repositoryRoot = resolve(import.meta.dirname, "..");
const adminDirectory = resolve(repositoryRoot, "public/admin");

function createElement(type, props, ...children) {
  return {
    children: children.flat(),
    props: props ?? {},
    type,
  };
}

function findElement(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;

  for (const child of node.children ?? []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }

  return undefined;
}

async function loadWidget() {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
    runScripts: "outside-only",
  });
  const { window } = dom;
  let registeredWidget;

  window.CMS = {
    createClass(definition) {
      return definition;
    },
    h: createElement,
    registerWidget(name, control) {
      registeredWidget = { control, name };
    },
  };

  for (const relativePath of ["vendor/marked.umd.js", "vendor/purify.min.js"]) {
    window.eval(await readFile(resolve(adminDirectory, relativePath), "utf8"));
  }
  window.eval(await readFile(resolve(adminDirectory, "paste-image.js"), "utf8"));

  return { dom, widget: registeredWidget };
}

test("CMS 预览依赖由本地构建产物提供", async () => {
  for (const filename of ["marked.umd.js", "purify.min.js", "mermaid.min.js"]) {
    const file = await stat(resolve(adminDirectory, "vendor", filename));
    assert.ok(file.size > 1000, filename + " should be copied to the CMS vendor directory");
  }

  const indexHtml = await readFile(resolve(adminDirectory, "index.html"), "utf8");
  assert.ok(
    indexHtml.indexOf("./vendor/marked.umd.js") < indexHtml.indexOf("./paste-image.js"),
    "Marked must load before the custom body widget",
  );
  assert.ok(
    indexHtml.indexOf("./vendor/purify.min.js") < indexHtml.indexOf("./paste-image.js"),
    "DOMPurify must load before the custom body widget",
  );
});

test("本地 Mermaid bundle 会暴露浏览器渲染 API", async () => {
  const source = await readFile(resolve(adminDirectory, "vendor/mermaid.min.js"));

  class LocalVendorLoader extends ResourceLoader {
    fetch(url) {
      if (url.endsWith("/mermaid.min.js")) return Promise.resolve(source);
      return null;
    }
  }

  const dom = new JSDOM('<script src="./mermaid.min.js"></script>', {
    resources: new LocalVendorLoader(),
    runScripts: "dangerously",
    url: "https://example.test/admin/",
  });
  await new Promise((resolveLoad) => dom.window.addEventListener("load", resolveLoad));

  assert.equal(typeof dom.window.mermaid?.render, "function");
  dom.window.close();
});

test("Markdown、Callout、Figure 与 Mermaid 都会生成预览节点", async () => {
  const fixture = await readFile(resolve(repositoryRoot, "tests/fixtures/cms-preview.mdx"), "utf8");
  const { dom, widget } = await loadWidget();

  assert.equal(widget.name, "mdx_paste");

  const loadingInstance = {
    setState(nextState) {
      this.state = { ...this.state, ...nextState };
    },
    state: { markdownPreviewReady: false },
  };
  widget.control.loadMarkdownPreview.call(loadingInstance);
  await new Promise((resolveTick) => setImmediate(resolveTick));
  assert.equal(loadingInstance.state.markdownPreviewReady, true);

  const instance = {
    props: { value: fixture },
    renderFigurePreview: widget.control.renderFigurePreview,
    renderMarkdownPreview: widget.control.renderMarkdownPreview,
    state: { markdownPreviewReady: true },
  };
  const preview = widget.control.renderPreview.call(instance);
  const markdownNode = findElement(
    preview,
    (node) => node.props?.className === "mdx-paste-control__markdown",
  );
  assert.ok(markdownNode, "standard Markdown should use the Markdown renderer");

  const markdownDom = new JSDOM(markdownNode.props.dangerouslySetInnerHTML.__html).window.document;
  assert.equal(markdownDom.querySelector("h2")?.textContent, "RDMA 快速入门");
  assert.equal(markdownDom.querySelectorAll("li").length, 2);
  assert.equal(markdownDom.querySelector("table tbody tr td")?.textContent, "RoCE");
  assert.match(markdownDom.querySelector("pre code")?.textContent ?? "", /int main/);

  const unsafePreview = widget.control.renderMarkdownPreview.call(
    instance,
    "## 安全测试\n<script>window.__unsafe = true;</script>",
    "unsafe",
  );
  const unsafeDom = new JSDOM(unsafePreview.props.dangerouslySetInnerHTML.__html).window.document;
  assert.equal(unsafeDom.querySelector("script"), null, "unsafe HTML must be removed");

  assert.ok(
    findElement(
      preview,
      (node) =>
        node.type === "section" &&
        node.props?.className?.includes("mdx-paste-control__callout--warning"),
    ),
    "Callout should use the corresponding preview style",
  );
  assert.ok(
    findElement(preview, (node) => node.type === "figure"),
    "Figure should produce a figure preview node",
  );
  assert.ok(
    findElement(preview, (node) => node.props?.["data-mermaid-source"]?.includes("flowchart LR")),
    "Mermaid should retain its chart source for renderer initialization",
  );

  dom.window.close();
});
