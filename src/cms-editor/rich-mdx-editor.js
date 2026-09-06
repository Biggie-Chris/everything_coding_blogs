import { Editor, Extension, Node, mergeAttributes } from "@tiptap/core";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import DragHandle from "@tiptap/extension-drag-handle";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import Suggestion from "@tiptap/suggestion";
import { common, createLowlight } from "lowlight";

import { __private__, editorJsonToMdx, mdxToEditorHtml } from "./mdx-format.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MEDIA_FOLDER = "public/uploads";
const PUBLIC_FOLDER = "/everything_coding_blogs/uploads";
const CALLOUTS = {
  note: { label: "备注", icon: "i", description: "补充背景或说明" },
  tip: { label: "提示", icon: "✦", description: "实践建议或技巧" },
  warning: { label: "注意", icon: "!", description: "需要特别留意的限制" },
  danger: { label: "警告", icon: "⚠", description: "风险或危险操作" },
};
const CODE_LANGUAGES = [
  ["plaintext", "纯文本"],
  ["c", "C"],
  ["cpp", "C++"],
  ["python", "Python"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["bash", "Bash"],
  ["shell", "Shell"],
  ["json", "JSON"],
  ["yaml", "YAML"],
  ["sql", "SQL"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["java", "Java"],
  ["xml", "HTML / XML"],
  ["css", "CSS"],
  ["markdown", "Markdown"],
];
const SUPPORTED_CODE_LANGUAGES = new Set(CODE_LANGUAGES.map(([language]) => language));
const lowlight = createLowlight(common);
const MIN_FIGURE_WIDTH = 20;
const MAX_FIGURE_WIDTH = 100;
let mermaidRenderId = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nodePosition(getPos) {
  const position = typeof getPos === "function" ? getPos() : getPos;
  return typeof position === "number" ? position : null;
}

function updateNodeAttributes(editor, getPos, node, attributes) {
  const position = nodePosition(getPos);
  if (position === null) return;
  const transaction = editor.state.tr.setNodeMarkup(position, undefined, {
    ...node.attrs,
    ...attributes,
  });
  editor.view.dispatch(transaction);
}

function deleteNode(editor, getPos, node) {
  const position = nodePosition(getPos);
  if (position === null) return;
  editor.view.dispatch(editor.state.tr.delete(position, position + node.nodeSize));
}

function normalizeFigureWidth(value) {
  if (value === "" || value === null || value === undefined) return MAX_FIGURE_WIDTH;
  const width = Number(value);
  if (!Number.isFinite(width)) return MAX_FIGURE_WIDTH;
  return Math.min(MAX_FIGURE_WIDTH, Math.max(MIN_FIGURE_WIDTH, Math.round(width)));
}

function createButton(label, className = "") {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = label;
  return button;
}

function createIconButton(label, title) {
  const button = createButton(label, "rich-mdx-editor__icon-button");
  button.title = title;
  button.setAttribute("aria-label", title);
  return button;
}

function createBlockAction({ icon, label, description, action }) {
  const button = createButton("", "rich-mdx-editor__block-action");
  button.innerHTML = `<span class="rich-mdx-editor__block-action-icon">${escapeHtml(icon)}</span><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span>`;
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => action());
  return button;
}

function filenameFor(file) {
  const extension =
    { "image/gif": "gif", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
      file.type
    ] || "png";
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `pasted-${stamp}.${extension}`;
}

function getPastedImage(event) {
  const items = event.clipboardData?.items || [];
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

function renderMermaid(target, chart) {
  const mermaid = window.mermaid || window.__esbuild_esm_mermaid_nm?.mermaid;
  if (!chart.trim()) {
    target.innerHTML =
      '<span class="rich-mdx-editor__empty-diagram">在左侧填写 Mermaid 图表代码。</span>';
    return;
  }
  if (!mermaid?.render) {
    target.innerHTML =
      '<span class="rich-mdx-editor__diagram-error">Mermaid 渲染器尚未加载。</span>';
    return;
  }

  const expectedChart = chart;
  target.textContent = "正在渲染图表…";
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
  mermaidRenderId += 1;
  mermaid
    .render(`rich-mdx-mermaid-${mermaidRenderId}`, chart)
    .then((result) => {
      if (target.dataset.chart === expectedChart) target.innerHTML = result.svg;
    })
    .catch(() => {
      if (target.dataset.chart === expectedChart) {
        target.innerHTML =
          '<span class="rich-mdx-editor__diagram-error">Mermaid 语法有误，暂时无法渲染。</span>';
      }
    });
}

function createCalloutNodeView({ node, getPos, editor }) {
  let currentNode = node;
  const wrapper = document.createElement("section");
  wrapper.className = "rich-mdx-editor__callout";
  wrapper.dataset.type = node.attrs.type;

  const header = document.createElement("div");
  header.className = "rich-mdx-editor__callout-header";
  header.contentEditable = "false";
  const select = document.createElement("select");
  select.className = "rich-mdx-editor__callout-kind";
  for (const [type, value] of Object.entries(CALLOUTS)) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = `${value.icon} ${value.label}`;
    select.append(option);
  }
  select.value = node.attrs.type;
  const description = document.createElement("span");
  description.className = "rich-mdx-editor__callout-description";
  header.append(select, description);

  const contentDOM = document.createElement("div");
  contentDOM.className = "rich-mdx-editor__callout-content";
  wrapper.append(header, contentDOM);

  const refresh = (updatedNode) => {
    const type = CALLOUTS[updatedNode.attrs.type] ? updatedNode.attrs.type : "note";
    wrapper.dataset.type = type;
    if (select.value !== type) select.value = type;
    description.textContent = CALLOUTS[type].description;
  };
  refresh(node);
  select.addEventListener("change", () =>
    updateNodeAttributes(editor, getPos, currentNode, { type: select.value }),
  );

  return {
    dom: wrapper,
    contentDOM,
    update(updatedNode) {
      if (updatedNode.type.name !== "callout") return false;
      currentNode = updatedNode;
      refresh(updatedNode);
      return true;
    },
    ignoreMutation(mutation) {
      return mutation.target === select || header.contains(mutation.target);
    },
  };
}

function createFigureNodeView(context) {
  return ({ node, getPos, editor }) => {
    let currentNode = node;
    const wrapper = document.createElement("figure");
    wrapper.className = "rich-mdx-editor__figure";
    wrapper.contentEditable = "false";
    const image = document.createElement("img");
    image.className = "rich-mdx-editor__figure-image";
    image.draggable = false;
    const resizeHandle = createButton("", "rich-mdx-editor__figure-resize");
    resizeHandle.setAttribute("aria-label", "调整图片宽度");
    resizeHandle.title = "拖动以调整图片宽度";
    resizeHandle.draggable = false;
    wrapper.append(image, resizeHandle);

    const update = (attributes) => updateNodeAttributes(editor, getPos, currentNode, attributes);
    const refresh = (updatedNode) => {
      const { src = "", alt = "" } = updatedNode.attrs;
      const resolved = context.getAsset?.(src) || src;
      image.src = resolved;
      image.alt = alt || "图片";
      const width = normalizeFigureWidth(updatedNode.attrs.width);
      wrapper.style.width = `${width}%`;
      wrapper.dataset.width = String(width);
    };
    refresh(node);

    image.addEventListener("click", () => {
      wrapper.classList.add("is-selected");
    });
    resizeHandle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const difference = event.key === "ArrowLeft" ? -5 : 5;
      update({
        width: normalizeFigureWidth(normalizeFigureWidth(currentNode.attrs.width) + difference),
      });
    });
    resizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = normalizeFigureWidth(currentNode.attrs.width);
      const parentWidth = wrapper.parentElement?.getBoundingClientRect().width || 0;
      const liveWidth = (clientX) =>
        normalizeFigureWidth(startWidth + ((clientX - startX) / parentWidth) * 100);
      const move = (moveEvent) => {
        if (!parentWidth) return;
        const width = liveWidth(moveEvent.clientX);
        wrapper.style.width = `${width}%`;
        wrapper.dataset.width = String(width);
      };
      const finish = (finishEvent) => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", finish);
        if (parentWidth) update({ width: liveWidth(finishEvent.clientX) });
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", finish, { once: true });
    });

    return {
      dom: wrapper,
      update(updatedNode) {
        if (updatedNode.type.name !== "figure") return false;
        currentNode = updatedNode;
        refresh(updatedNode);
        return true;
      },
      ignoreMutation() {
        return true;
      },
    };
  };
}

function createCodeBlockNodeView({ node, getPos, editor }) {
  let currentNode = node;
  const wrapper = document.createElement("section");
  wrapper.className = "rich-mdx-editor__code-block";
  const header = document.createElement("div");
  header.className = "rich-mdx-editor__code-block-header";
  header.contentEditable = "false";
  const label = document.createElement("strong");
  label.textContent = "代码块";
  const description = document.createElement("span");
  description.textContent = "选择语言后即时高亮";
  const language = document.createElement("select");
  language.className = "rich-mdx-editor__code-language";
  language.setAttribute("aria-label", "代码语言");
  CODE_LANGUAGES.forEach(([value, name]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    language.append(option);
  });
  header.append(label, description, language);

  const pre = document.createElement("pre");
  pre.className = "rich-mdx-editor__code-pre";
  const contentDOM = document.createElement("code");
  contentDOM.spellcheck = false;
  pre.append(contentDOM);
  wrapper.append(header, pre);

  const refresh = (updatedNode) => {
    const currentLanguage = SUPPORTED_CODE_LANGUAGES.has(updatedNode.attrs.language)
      ? updatedNode.attrs.language
      : "plaintext";
    if (language.value !== currentLanguage) language.value = currentLanguage;
    contentDOM.className = `language-${currentLanguage}`;
  };
  refresh(node);
  language.addEventListener("change", () =>
    updateNodeAttributes(editor, getPos, currentNode, { language: language.value }),
  );

  return {
    dom: wrapper,
    contentDOM,
    update(updatedNode) {
      if (updatedNode.type.name !== "codeBlock") return false;
      currentNode = updatedNode;
      refresh(updatedNode);
      return true;
    },
    ignoreMutation(mutation) {
      return header.contains(mutation.target);
    },
  };
}

const SyntaxCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return createCodeBlockNodeView;
  },
});

function createMermaidNodeView() {
  return ({ node, getPos, editor }) => {
    let currentNode = node;
    let renderTimer;
    const wrapper = document.createElement("section");
    wrapper.className = "rich-mdx-editor__mermaid";
    wrapper.contentEditable = "false";
    const header = document.createElement("div");
    header.className = "rich-mdx-editor__special-header";
    header.innerHTML = "<strong>Mermaid 图表</strong><span>修改图表代码后即时渲染</span>";
    const editorGrid = document.createElement("div");
    editorGrid.className = "rich-mdx-editor__mermaid-grid";
    const textarea = document.createElement("textarea");
    textarea.className = "rich-mdx-editor__mermaid-source";
    textarea.spellcheck = false;
    textarea.setAttribute("aria-label", "Mermaid 图表代码");
    const preview = document.createElement("div");
    preview.className = "rich-mdx-editor__mermaid-preview";
    editorGrid.append(textarea, preview);
    const removeButton = createButton(
      "删除图表",
      "rich-mdx-editor__danger-button rich-mdx-editor__special-delete",
    );
    wrapper.append(header, editorGrid, removeButton);

    const draw = (chart) => {
      window.clearTimeout(renderTimer);
      preview.dataset.chart = chart;
      renderTimer = window.setTimeout(() => renderMermaid(preview, chart), 220);
    };
    const refresh = (updatedNode) => {
      const chart = updatedNode.attrs.chart || "";
      if (document.activeElement !== textarea) textarea.value = chart;
      draw(chart);
    };
    refresh(node);
    textarea.addEventListener("input", () => {
      const chart = textarea.value;
      updateNodeAttributes(editor, getPos, currentNode, { chart });
      draw(chart);
    });
    removeButton.addEventListener("click", () => deleteNode(editor, getPos, currentNode));

    return {
      dom: wrapper,
      update(updatedNode) {
        if (updatedNode.type.name !== "mermaid") return false;
        currentNode = updatedNode;
        refresh(updatedNode);
        return true;
      },
      destroy() {
        window.clearTimeout(renderTimer);
      },
      ignoreMutation() {
        return true;
      },
    };
  };
}

function openRawMdxDialog(initialSource, onSave) {
  const overlay = document.createElement("div");
  overlay.className = "rich-mdx-editor__dialog-overlay";
  const dialog = document.createElement("section");
  dialog.className = "rich-mdx-editor__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.innerHTML =
    "<h3>编辑原始 MDX 块</h3><p>此块使用了当前可视化编辑器尚不认识的 JSX。保留它可避免发布时丢失内容。</p>";
  const textarea = document.createElement("textarea");
  textarea.value = initialSource;
  textarea.spellcheck = false;
  const footer = document.createElement("div");
  footer.className = "rich-mdx-editor__dialog-footer";
  const cancel = createButton("取消", "rich-mdx-editor__secondary-button");
  const save = createButton("保存 MDX 块", "rich-mdx-editor__primary-button");
  footer.append(cancel, save);
  dialog.append(textarea, footer);
  overlay.append(dialog);
  document.body.append(overlay);
  textarea.focus();
  const close = () => overlay.remove();
  cancel.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  save.addEventListener("click", () => {
    onSave(textarea.value);
    close();
  });
}

function createRawMdxNodeView() {
  return ({ node, getPos, editor }) => {
    let currentNode = node;
    const wrapper = document.createElement("section");
    wrapper.className = "rich-mdx-editor__raw-mdx";
    wrapper.contentEditable = "false";
    const text = document.createElement("div");
    text.className = "rich-mdx-editor__raw-mdx-text";
    const edit = createButton("编辑 MDX 块", "rich-mdx-editor__secondary-button");
    const remove = createButton("删除", "rich-mdx-editor__danger-button");
    wrapper.append(text, edit, remove);
    const refresh = (updatedNode) => {
      const firstLine =
        String(updatedNode.attrs.source || "")
          .trim()
          .split("\n")[0] || "空 MDX 块";
      text.textContent = `原始 MDX · ${firstLine.slice(0, 80)}`;
    };
    refresh(node);
    edit.addEventListener("click", () =>
      openRawMdxDialog(currentNode.attrs.source || "", (source) =>
        updateNodeAttributes(editor, getPos, currentNode, { source }),
      ),
    );
    remove.addEventListener("click", () => deleteNode(editor, getPos, currentNode));
    return {
      dom: wrapper,
      update(updatedNode) {
        if (updatedNode.type.name !== "rawMdx") return false;
        currentNode = updatedNode;
        refresh(updatedNode);
        return true;
      },
      ignoreMutation() {
        return true;
      },
    };
  };
}

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { type: { default: "note" } };
  },
  parseHTML() {
    return [{ tag: "section[data-mdx-callout]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-mdx-callout": "true", "data-type": node.attrs.type }),
      0,
    ];
  },
  addNodeView() {
    return createCalloutNodeView;
  },
});

const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addOptions() {
    return { context: {} };
  },
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: MAX_FIGURE_WIDTH },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-mdx-figure]",
        getAttrs: (element) => ({
          src: __private__.decodeAttribute(element.getAttribute("data-src")),
          alt: __private__.decodeAttribute(element.getAttribute("data-alt")),
          caption: __private__.decodeAttribute(element.getAttribute("data-caption")),
          width: __private__.decodeAttribute(element.getAttribute("data-width")),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-mdx-figure": "true" })];
  },
  addNodeView() {
    return createFigureNodeView(this.options.context);
  },
});

const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { chart: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-mdx-mermaid]",
        getAttrs: (element) => ({
          chart: __private__.decodeAttribute(element.getAttribute("data-chart")),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-mdx-mermaid": "true" })];
  },
  addNodeView() {
    return createMermaidNodeView();
  },
});

const RawMdx = Node.create({
  name: "rawMdx",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { source: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-mdx-raw]",
        getAttrs: (element) => ({
          source: __private__.decodeAttribute(element.getAttribute("data-source")),
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-mdx-raw": "true" })];
  },
  addNodeView() {
    return createRawMdxNodeView();
  },
});

function createSlashMenu(items) {
  return Extension.create({
    name: "richMdxSlashMenu",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          startOfLine: false,
          items: ({ query }) =>
            items.filter((item) =>
              `${item.label} ${item.keywords}`.toLowerCase().includes(query.toLowerCase()),
            ),
          command: ({ editor, range, props }) => props.command({ editor, range }),
          render: () => {
            let menu;
            let unmount;
            let selectedIndex = 0;
            let currentProps;
            const choose = (index) => {
              const item = currentProps?.items[index];
              if (item) currentProps.command(item);
            };
            const renderItems = (props) => {
              currentProps = props;
              selectedIndex = Math.min(selectedIndex, Math.max(0, props.items.length - 1));
              menu.replaceChildren();
              if (!props.items.length) {
                const empty = document.createElement("div");
                empty.className = "rich-mdx-editor__slash-empty";
                empty.textContent = "没有匹配的块";
                menu.append(empty);
                return;
              }
              props.items.forEach((item, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = `rich-mdx-editor__slash-item${index === selectedIndex ? " is-active" : ""}`;
                button.innerHTML = `<span class="rich-mdx-editor__slash-icon">${escapeHtml(item.icon)}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description)}</small></span>`;
                button.addEventListener("mousedown", (event) => {
                  event.preventDefault();
                  choose(index);
                });
                menu.append(button);
              });
            };
            return {
              onStart(props) {
                menu = document.createElement("div");
                menu.className = "rich-mdx-editor__slash-menu";
                renderItems(props);
                unmount = props.mount(menu);
              },
              onUpdate(props) {
                renderItems(props);
              },
              onKeyDown({ event }) {
                if (!currentProps?.items.length) return false;
                if (event.key === "ArrowDown") {
                  selectedIndex = (selectedIndex + 1) % currentProps.items.length;
                  renderItems(currentProps);
                  return true;
                }
                if (event.key === "ArrowUp") {
                  selectedIndex =
                    (selectedIndex + currentProps.items.length - 1) % currentProps.items.length;
                  renderItems(currentProps);
                  return true;
                }
                if (event.key === "Enter") {
                  choose(selectedIndex);
                  return true;
                }
                if (event.key === "Escape") return false;
                return false;
              },
              onExit() {
                unmount?.();
                menu = undefined;
              },
            };
          },
        }),
      ];
    },
  });
}

function insertBlock(editor, range, content, command) {
  const chain = editor.chain().focus().deleteRange(range);
  if (content) chain.insertContent(content);
  if (command) command(chain);
  chain.run();
}

function injectStyles() {
  if (document.getElementById("rich-mdx-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "rich-mdx-editor-styles";
  style.textContent = `
    .rich-mdx-editor{border:1px solid #ccd6dc;border-radius:10px;background:#fff;color:#1f2933;box-shadow:0 1px 2px rgba(15,23,42,.03);overflow:hidden}
    .rich-mdx-editor__hint{color:#637381;font-size:13px;line-height:1.6;margin:0 0 10px}.rich-mdx-editor__toolbar{align-items:center;background:#fbfcfd;border-bottom:1px solid #dce4e8;display:flex;flex-wrap:wrap;gap:5px;padding:8px 10px;position:sticky;top:0;z-index:3}.rich-mdx-editor__toolbar-group{align-items:center;border-right:1px solid #dce4e8;display:flex;gap:4px;padding-right:7px}.rich-mdx-editor__toolbar-group:last-child{border-right:0}.rich-mdx-editor__toolbar button,.rich-mdx-editor__toolbar select,.rich-mdx-editor__secondary-button,.rich-mdx-editor__primary-button,.rich-mdx-editor__danger-button{border:1px solid #aebdc6;border-radius:5px;background:#fff;color:#253744;cursor:pointer;font:inherit;font-size:13px;line-height:1.2;padding:6px 8px}.rich-mdx-editor__toolbar button:hover,.rich-mdx-editor__toolbar button.is-active,.rich-mdx-editor__toolbar select:hover,.rich-mdx-editor__secondary-button:hover{background:#eef5f8}.rich-mdx-editor__toolbar button.is-active{border-color:#3978a7;color:#145d94}.rich-mdx-editor__toolbar select{max-width:120px}.rich-mdx-editor__icon-button{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:700;min-width:31px}.rich-mdx-editor__primary-button{background:#195f8f;border-color:#195f8f;color:#fff}.rich-mdx-editor__primary-button:hover{background:#124d77}.rich-mdx-editor__danger-button{border-color:#d6a1a1;color:#a43030}.rich-mdx-editor__danger-button:hover{background:#fff0f0}.rich-mdx-editor__canvas{min-height:480px;padding:22px 28px}.rich-mdx-editor__canvas:focus{outline:none}.rich-mdx-editor__canvas>*:first-child{margin-top:0}.rich-mdx-editor__canvas h1,.rich-mdx-editor__canvas h2,.rich-mdx-editor__canvas h3,.rich-mdx-editor__canvas h4{color:#132b3a;line-height:1.3;margin:1.45em 0 .55em}.rich-mdx-editor__canvas h1{font-size:2em}.rich-mdx-editor__canvas h2{font-size:1.55em}.rich-mdx-editor__canvas h3{font-size:1.27em}.rich-mdx-editor__canvas p,.rich-mdx-editor__canvas ul,.rich-mdx-editor__canvas ol{font-size:15px;line-height:1.8;margin:.8em 0}.rich-mdx-editor__canvas ul,.rich-mdx-editor__canvas ol{padding-left:1.75em}.rich-mdx-editor__canvas li>p{margin:.2em 0}.rich-mdx-editor__canvas blockquote{border-left:4px solid #91afbe;color:#4c6471;margin:1em 0;padding:.25em 0 .25em 1em}.rich-mdx-editor__canvas code{background:#edf2f4;border-radius:3px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em;padding:1px 4px}.rich-mdx-editor__canvas pre{background:#182832;border-radius:7px;color:#edf6f8;margin:1em 0;overflow:auto;padding:14px}.rich-mdx-editor__canvas pre code{background:transparent;color:inherit;padding:0}.rich-mdx-editor__canvas hr{border:0;border-top:1px solid #d8e1e6;margin:1.8em 0}.rich-mdx-editor__canvas a{color:#146a9e;text-decoration:underline}.rich-mdx-editor__canvas table{border-collapse:collapse;margin:1em 0;max-width:100%;overflow:auto}.rich-mdx-editor__canvas td,.rich-mdx-editor__canvas th{border:1px solid #cfdbe1;min-width:86px;padding:7px 9px;vertical-align:top}.rich-mdx-editor__canvas th{background:#f1f6f8;font-weight:700}.rich-mdx-editor__canvas .selectedCell:after{background:rgba(69,135,177,.12)}
    .rich-mdx-editor__callout{border-left:4px solid #4b83b4;border-radius:7px;background:#eef6fd;margin:1em 0;padding:0 15px 12px}.rich-mdx-editor__callout[data-type="tip"]{border-left-color:#23866b;background:#edf9f4}.rich-mdx-editor__callout[data-type="warning"]{border-left-color:#b67617;background:#fff8e8}.rich-mdx-editor__callout[data-type="danger"]{border-left-color:#c64d4d;background:#fff0f0}.rich-mdx-editor__callout-header{align-items:center;border-bottom:1px solid rgba(68,104,126,.14);display:flex;gap:9px;margin-bottom:8px;padding:8px 0}.rich-mdx-editor__callout-kind{border:0;background:transparent;color:#233d4e;font-size:13px;font-weight:700;padding:2px}.rich-mdx-editor__callout-description{color:#6b7d87;font-size:12px}.rich-mdx-editor__callout-content>*:last-child{margin-bottom:0}
    .rich-mdx-editor__mermaid{border:1px solid #cad8df;border-radius:8px;background:#fbfdfe;margin:1.2em 0;overflow:hidden;padding:12px;position:relative}.rich-mdx-editor__special-header{align-items:baseline;display:flex;gap:9px;margin-bottom:9px}.rich-mdx-editor__special-header strong{color:#244353;font-size:14px}.rich-mdx-editor__special-header span{color:#70818b;font-size:12px}.rich-mdx-editor__mermaid-grid{display:grid;gap:10px;grid-template-columns:minmax(190px,.85fr) minmax(240px,1.15fr)}.rich-mdx-editor__mermaid-source{background:#172731;border:0;border-radius:5px;color:#e8f3f5;font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;min-height:150px;padding:10px;resize:vertical}.rich-mdx-editor__mermaid-preview{align-items:center;background:#fff;border:1px solid #dce5e8;border-radius:5px;display:flex;justify-content:center;min-height:150px;overflow:auto;padding:8px}.rich-mdx-editor__mermaid-preview svg{max-width:100%}.rich-mdx-editor__empty-diagram,.rich-mdx-editor__diagram-error{color:#6b7a84;font-size:13px}.rich-mdx-editor__diagram-error{color:#a33434}.rich-mdx-editor__special-delete{margin-top:9px}
    .rich-mdx-editor__raw-mdx{align-items:center;background:#f6f8fa;border:1px dashed #aebdc6;border-radius:7px;display:flex;flex-wrap:wrap;gap:8px;margin:1em 0;padding:10px}.rich-mdx-editor__raw-mdx-text{color:#4c6070;flex:1 1 250px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rich-mdx-editor__slash-menu{background:#fff;border:1px solid #c9d5db;border-radius:8px;box-shadow:0 12px 28px rgba(24,52,68,.17);max-height:320px;min-width:275px;overflow:auto;padding:5px;z-index:1000}.rich-mdx-editor__slash-item{align-items:center;background:transparent;border:0;border-radius:5px;color:#243944;cursor:pointer;display:flex;gap:9px;padding:7px;text-align:left;width:100%}.rich-mdx-editor__slash-item:hover,.rich-mdx-editor__slash-item.is-active{background:#edf5f8}.rich-mdx-editor__slash-icon{align-items:center;background:#e7f0f4;border-radius:4px;color:#276a95;display:flex;font-weight:700;height:27px;justify-content:center;width:27px}.rich-mdx-editor__slash-item strong,.rich-mdx-editor__slash-item small{display:block}.rich-mdx-editor__slash-item small{color:#71818a;font-size:11px;margin-top:2px}.rich-mdx-editor__slash-empty{color:#71818a;font-size:13px;padding:9px}.rich-mdx-editor__dialog-overlay{align-items:center;background:rgba(15,30,40,.38);display:flex;inset:0;justify-content:center;padding:20px;position:fixed;z-index:1200}.rich-mdx-editor__dialog{background:#fff;border-radius:10px;box-shadow:0 16px 42px rgba(10,27,39,.3);max-width:760px;padding:20px;width:min(760px,100%)}.rich-mdx-editor__dialog h3{margin:0 0 7px}.rich-mdx-editor__dialog p{color:#5e707b;font-size:13px;line-height:1.55}.rich-mdx-editor__dialog textarea{box-sizing:border-box;border:1px solid #aebdc6;border-radius:6px;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;min-height:260px;padding:10px;width:100%}.rich-mdx-editor__dialog-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}@media(max-width:760px){.rich-mdx-editor__canvas{padding:16px}.rich-mdx-editor__mermaid-grid{grid-template-columns:1fr}.rich-mdx-editor__toolbar-group{border-right:0}.rich-mdx-editor__toolbar{position:static}}
    .rich-mdx-editor__code-block{border:1px solid #223741;border-radius:8px;background:#182832;color:#edf6f8;margin:1.1em 0;overflow:hidden}.rich-mdx-editor__code-block-header{align-items:center;background:#223741;display:flex;gap:9px;padding:7px 10px}.rich-mdx-editor__code-block-header strong{font-size:13px}.rich-mdx-editor__code-block-header span{color:#abc0c8;font-size:12px}.rich-mdx-editor__code-language{margin-left:auto;border:1px solid #526a74;border-radius:4px;background:#172731;color:#edf6f8;font:12px ui-monospace,SFMono-Regular,Consolas,monospace;padding:4px 6px}.rich-mdx-editor__code-pre{border-radius:0!important;margin:0!important;min-height:52px;padding:14px!important}.rich-mdx-editor__code-pre code{display:block;min-height:24px;outline:none;white-space:pre}.rich-mdx-editor__code-block .hljs-comment,.rich-mdx-editor__code-block .hljs-quote{color:#90a6ad}.rich-mdx-editor__code-block .hljs-keyword,.rich-mdx-editor__code-block .hljs-selector-tag,.rich-mdx-editor__code-block .hljs-literal{color:#fc9f7d}.rich-mdx-editor__code-block .hljs-string,.rich-mdx-editor__code-block .hljs-attr,.rich-mdx-editor__code-block .hljs-template-variable{color:#b8da88}.rich-mdx-editor__code-block .hljs-number,.rich-mdx-editor__code-block .hljs-symbol,.rich-mdx-editor__code-block .hljs-bullet{color:#d6b5f0}.rich-mdx-editor__code-block .hljs-title,.rich-mdx-editor__code-block .hljs-function,.rich-mdx-editor__code-block .hljs-type{color:#7fcff2}.rich-mdx-editor__code-block .hljs-built_in,.rich-mdx-editor__code-block .hljs-variable{color:#f0c67c}
    .rich-mdx-editor-shell{margin:12px 0 20px;max-width:100%}.rich-mdx-editor-shell>.rich-mdx-editor__hint{border:1px solid #dce7ed;border-radius:10px;background:#f6fafc;color:#55707d;margin:0 0 10px;padding:9px 12px}.rich-mdx-editor{border:1px solid #dfe7eb;border-radius:14px;background:#fff;box-shadow:0 18px 46px rgba(25,53,70,.09);overflow:visible}.rich-mdx-editor__status{align-items:center;background:linear-gradient(90deg,#f8fbfd,#f2f8fb);border-bottom:1px solid #e4ebef;color:#6b7e88;display:flex;font-size:12px;letter-spacing:.01em;padding:9px 18px}.rich-mdx-editor__status:before{background:#46a578;border-radius:999px;content:"";height:7px;margin-right:7px;width:7px}.rich-mdx-editor__toolbar{background:rgba(255,255,255,.96);border-bottom:1px solid #e5ebee;box-shadow:none;gap:7px;padding:9px 14px;top:8px}.rich-mdx-editor__toolbar-group{gap:5px;padding-right:9px}.rich-mdx-editor__toolbar button,.rich-mdx-editor__toolbar select,.rich-mdx-editor__secondary-button{border-color:transparent;border-radius:7px}.rich-mdx-editor__toolbar button:hover,.rich-mdx-editor__toolbar button.is-active,.rich-mdx-editor__toolbar select:hover,.rich-mdx-editor__secondary-button:hover{background:#eaf3f7;border-color:#d9e8ef}.rich-mdx-editor__canvas{box-sizing:border-box;max-width:900px;min-height:620px;margin:0 auto;padding:40px 74px 80px}.rich-mdx-editor__canvas h1{font-size:2.35em;letter-spacing:-.035em}.rich-mdx-editor__canvas h2{font-size:1.65em;letter-spacing:-.02em}.rich-mdx-editor__canvas p,.rich-mdx-editor__canvas ul,.rich-mdx-editor__canvas ol{font-size:16px;line-height:1.86}.rich-mdx-editor__canvas p.is-editor-empty:first-child:before{color:#a4b2ba;font-style:normal}.rich-mdx-editor__bubble-menu{align-items:center;background:#172934;border:1px solid rgba(255,255,255,.12);border-radius:9px;box-shadow:0 12px 26px rgba(11,29,39,.28);display:flex;gap:2px;padding:4px;z-index:50}.rich-mdx-editor__bubble-button{border:0!important;border-radius:6px!important;background:transparent!important;color:#f7fbfc!important;cursor:pointer;font:600 13px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;min-width:30px;padding:6px!important}.rich-mdx-editor__bubble-button:hover,.rich-mdx-editor__bubble-button.is-active{background:#315364!important}.rich-mdx-editor__drag-handle{align-items:center;display:flex;gap:2px;opacity:0;transition:opacity .14s ease}.rich-mdx-editor__drag-handle:hover,.rich-mdx-editor__drag-handle:focus-within{opacity:1}.rich-mdx-editor__drag-grip,.rich-mdx-editor__block-add{align-items:center;border:0;border-radius:5px;background:transparent;color:#738994;cursor:grab;display:flex;font:700 17px/1 ui-sans-serif,system-ui;padding:3px 5px}.rich-mdx-editor__drag-grip:hover,.rich-mdx-editor__block-add:hover{background:#e8f1f5;color:#215f7e}.rich-mdx-editor__block-add{cursor:pointer;font-size:19px;font-weight:400}.rich-mdx-editor__block-menu{box-sizing:border-box;background:#fff;border:1px solid #d8e3e8;border-radius:12px;box-shadow:0 16px 38px rgba(28,55,70,.2);max-height:min(460px,calc(100vh - 24px));overflow:auto;padding:8px;position:fixed;width:310px;z-index:9999}.rich-mdx-editor__block-menu-heading{border-bottom:1px solid #edf1f3;color:#6e818b;display:flex;flex-direction:column;font-size:12px;gap:2px;padding:7px 8px 10px}.rich-mdx-editor__block-menu-heading strong{color:#1e3948;font-size:13px}.rich-mdx-editor__block-actions{display:grid;gap:2px;padding-top:5px}.rich-mdx-editor__block-action{align-items:center;border:0!important;border-radius:8px!important;background:transparent!important;color:#27404d!important;cursor:pointer;display:flex;gap:9px;padding:7px!important;text-align:left;width:100%}.rich-mdx-editor__block-action:hover{background:#edf5f8!important}.rich-mdx-editor__block-action-icon{align-items:center;background:#edf4f7;border:1px solid #deebf0;border-radius:6px;color:#286889;display:flex;font:700 12px/1 ui-monospace,SFMono-Regular,Consolas,monospace;height:30px;justify-content:center;width:30px}.rich-mdx-editor__block-action strong,.rich-mdx-editor__block-action small{display:block}.rich-mdx-editor__block-action strong{font-size:13px}.rich-mdx-editor__block-action small{color:#71848e;font-size:11px;margin-top:2px}.rich-mdx-editor__code-block{box-shadow:0 7px 16px rgba(20,40,50,.15)}@media(max-width:760px){.rich-mdx-editor__canvas{min-height:480px;padding:25px 18px 54px}.rich-mdx-editor__status{padding:8px 12px}.rich-mdx-editor__toolbar{padding:8px}.rich-mdx-editor__block-menu{left:12px!important;right:12px;width:auto}.rich-mdx-editor__drag-handle{opacity:1}}
    .rich-mdx-editor__figure{border:0!important;background:transparent!important;border-radius:0!important;line-height:0;margin:1.35em auto!important;max-width:100%;padding:0!important;position:relative}.rich-mdx-editor__figure-image{border:0;border-radius:8px;cursor:default;display:block;height:auto;max-height:none;max-width:100%;width:100%}.rich-mdx-editor__figure.is-selected .rich-mdx-editor__figure-image,.rich-mdx-editor__figure:hover .rich-mdx-editor__figure-image{box-shadow:0 0 0 2px #8cc4de}.rich-mdx-editor__figure-resize{border:2px solid #fff!important;border-radius:50%!important;background:#27749b!important;bottom:-7px;cursor:nwse-resize;height:14px;opacity:0;padding:0!important;position:absolute;right:-7px;transition:opacity .14s ease;width:14px;z-index:2}.rich-mdx-editor__figure:hover .rich-mdx-editor__figure-resize,.rich-mdx-editor__figure.is-selected .rich-mdx-editor__figure-resize,.rich-mdx-editor__figure-resize:focus-visible{opacity:1}.rich-mdx-editor__figure-resize:focus-visible{outline:2px solid #155b82;outline-offset:2px}
  `;
  document.head.append(style);
}

class MdxRichEditor {
  constructor({ element, value = "", onChange, onAddAsset, getAsset }) {
    injectStyles();
    this.element = element;
    this.onChange = onChange;
    this.onAddAsset = onAddAsset;
    this.getAsset = getAsset;
    this.lastValue = String(value || "");
    this.status = document.createElement("div");
    this.status.className = "rich-mdx-editor__status";
    this.status.setAttribute("aria-live", "polite");
    this.toolbar = document.createElement("div");
    this.toolbar.className = "rich-mdx-editor__toolbar";
    this.canvas = document.createElement("div");
    this.canvas.className = "rich-mdx-editor__canvas";
    this.canvas.setAttribute("aria-label", "文章正文编辑器");
    const shell = document.createElement("section");
    shell.className = "rich-mdx-editor";
    this.shell = shell;
    this.bubbleMenu = this.createBubbleMenu();
    this.blockMenu = this.createBlockMenu();
    shell.append(this.status, this.toolbar, this.canvas, this.bubbleMenu);
    document.body.append(this.blockMenu);
    element.replaceChildren(shell);

    const visualContext = {
      getAsset: (src) => this.getAsset?.(src),
      stageImage: (file, replace) => this.stageImage(file, replace),
    };
    const slashItems = this.slashItems();
    this.editor = new Editor({
      element: this.canvas,
      extensions: [
        StarterKit.configure({ link: false, codeBlock: false }),
        SyntaxCodeBlock.configure({ lowlight, defaultLanguage: "plaintext" }),
        Link.configure({ autolink: true, defaultProtocol: "https", openOnClick: false }),
        Image.configure({ allowBase64: false }),
        Placeholder.configure({ placeholder: "输入 / 插入一个内容块，或直接开始写作…" }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Callout,
        Figure.configure({ context: visualContext }),
        Mermaid,
        RawMdx,
        BubbleMenu.configure({
          element: this.bubbleMenu,
          shouldShow: ({ editor, state }) => !state.selection.empty && editor.isEditable,
          options: { offset: 10, placement: "top", strategy: "fixed" },
        }),
        DragHandle.configure({
          render: () => this.createDragHandle(),
          computePositionConfig: { placement: "left-start", strategy: "fixed" },
          nested: true,
        }),
        createSlashMenu(slashItems),
      ],
      content: this.toEditorHtml(this.lastValue),
      editorProps: {
        attributes: { class: "rich-mdx-editor__canvas" },
        handlePaste: (_view, event) => {
          const image = getPastedImage(event);
          if (!image) return false;
          event.preventDefault();
          this.stageImage(image);
          return true;
        },
      },
      onUpdate: () => {
        this.emitValue();
        this.updateStatus();
      },
    });
    this.renderToolbar();
    this.updateStatus();
    this.closeBlockMenu = this.closeBlockMenu.bind(this);
    document.addEventListener("mousedown", this.closeBlockMenu);
  }

  createBubbleMenu() {
    const menu = document.createElement("div");
    menu.className = "rich-mdx-editor__bubble-menu";
    menu.style.visibility = "hidden";
    const button = (label, title, action, active) => {
      const control = createButton(label, "rich-mdx-editor__bubble-button");
      control.title = title;
      control.setAttribute("aria-label", title);
      control.addEventListener("mousedown", (event) => event.preventDefault());
      control.addEventListener("click", () => action());
      if (active) {
        this.editor?.on("transaction", () => control.classList.toggle("is-active", active()));
      }
      return control;
    };
    menu.append(
      button(
        "B",
        "加粗",
        () => this.editor.chain().focus().toggleBold().run(),
        () => this.editor.isActive("bold"),
      ),
      button(
        "I",
        "斜体",
        () => this.editor.chain().focus().toggleItalic().run(),
        () => this.editor.isActive("italic"),
      ),
      button(
        "</>",
        "行内代码",
        () => this.editor.chain().focus().toggleCode().run(),
        () => this.editor.isActive("code"),
      ),
      button("↗", "插入链接", () => {
        const href = window.prompt("链接地址");
        if (href) this.editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }),
    );
    return menu;
  }

  createDragHandle() {
    const handle = document.createElement("div");
    handle.className = "rich-mdx-editor__drag-handle";
    handle.setAttribute("aria-label", "拖动内容块，或插入新内容块");
    const grip = document.createElement("span");
    grip.className = "rich-mdx-editor__drag-grip";
    grip.textContent = "⠿";
    grip.title = "拖动内容块";
    const add = createButton("+", "rich-mdx-editor__block-add");
    add.title = "在当前位置插入内容块";
    add.setAttribute("aria-label", "在当前位置插入内容块");
    add.draggable = false;
    add.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    add.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openBlockMenu(handle);
    });
    handle.append(grip, add);
    return handle;
  }

  createBlockMenu() {
    const menu = document.createElement("section");
    menu.className = "rich-mdx-editor__block-menu";
    menu.hidden = true;
    menu.setAttribute("aria-label", "插入内容块");
    const heading = document.createElement("div");
    heading.className = "rich-mdx-editor__block-menu-heading";
    heading.innerHTML = "<strong>插入内容块</strong><span>也可以在正文输入 /</span>";
    const items = document.createElement("div");
    items.className = "rich-mdx-editor__block-actions";
    const closeAfter = (action) => () => {
      action();
      this.closeBlockMenu();
    };
    [
      {
        icon: "T",
        label: "正文",
        description: "普通段落文字",
        action: () => this.editor.chain().focus().setParagraph().run(),
      },
      {
        icon: "H2",
        label: "二级标题",
        description: "组织文章章节",
        action: () => this.editor.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        icon: "•",
        label: "项目列表",
        description: "无序列表",
        action: () => this.editor.chain().focus().toggleBulletList().run(),
      },
      {
        icon: "❝",
        label: "引用",
        description: "突出一段引用",
        action: () => this.editor.chain().focus().toggleBlockquote().run(),
      },
      {
        icon: "</>",
        label: "代码块",
        description: "选择语言并即时高亮",
        action: () => this.editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        icon: "▧",
        label: "图片",
        description: "选择或直接粘贴图片",
        action: () => this.pickImage(),
      },
      {
        icon: "i",
        label: "Callout",
        description: "提示、注意或警告块",
        action: () => this.insertCallout("note"),
      },
      {
        icon: "◇",
        label: "Mermaid",
        description: "可编辑的实时图表",
        action: () => this.insertMermaid(),
      },
    ].forEach((item) =>
      items.append(createBlockAction({ ...item, action: closeAfter(item.action) })),
    );
    menu.append(heading, items);
    return menu;
  }

  openBlockMenu(anchor) {
    const rect = anchor.getBoundingClientRect();
    this.blockMenu.hidden = false;
    this.blockMenu.style.left = `${Math.max(12, rect.right + 8)}px`;
    this.blockMenu.style.top = `${Math.max(12, rect.top)}px`;
  }

  closeBlockMenu(event) {
    if (event && this.blockMenu.contains(event.target)) return;
    this.blockMenu.hidden = true;
  }

  pickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.hidden = true;
    input.addEventListener("change", () => {
      const [file] = input.files || [];
      if (file) this.stageImage(file);
      input.remove();
    });
    document.body.append(input);
    input.click();
  }

  updateStatus() {
    const content = this.editor?.getText().replace(/\s/g, "") || "";
    this.status.textContent = `实时编辑中 · ${content.length} 字 · 点击 Publish 后会与文章及图片一同提交`;
  }

  toEditorHtml(value) {
    return mdxToEditorHtml(value, (html) => {
      if (!window.DOMPurify?.sanitize) return html;
      return window.DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    });
  }

  stageImage(file, replace) {
    if (!file.type.startsWith("image/")) {
      window.alert("只能插入图片文件。");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      window.alert("图片不能超过 10 MB。");
      return;
    }
    if (typeof this.onAddAsset !== "function") {
      window.alert("图片暂存功能尚未就绪，请刷新页面后重试。");
      return;
    }
    const name = filenameFor(file);
    const src = `${PUBLIC_FOLDER}/${name}`;
    this.onAddAsset({ file, name, path: `${MEDIA_FOLDER}/${name}` });
    if (replace) {
      replace(src);
    } else {
      this.editor
        .chain()
        .focus()
        .insertContent({ type: "figure", attrs: { src, alt: "粘贴的图片", caption: "" } })
        .run();
    }
  }

  emitValue() {
    const value = editorJsonToMdx(this.editor.getJSON());
    this.lastValue = value;
    this.onChange?.(value);
  }

  updateValue(value) {
    const nextValue = String(value || "");
    if (nextValue === this.lastValue) return;
    this.lastValue = nextValue;
    this.editor.commands.setContent(this.toEditorHtml(nextValue), { emitUpdate: false });
  }

  slashItems() {
    const insert =
      (content) =>
      ({ editor, range }) =>
        insertBlock(editor, range, content);
    return [
      {
        label: "一级标题",
        keywords: "heading h1 标题",
        icon: "H1",
        description: "文章主标题",
        command: ({ editor, range }) =>
          insertBlock(editor, range, null, (chain) => chain.setHeading({ level: 1 })),
      },
      {
        label: "二级标题",
        keywords: "heading h2 标题",
        icon: "H2",
        description: "章节标题",
        command: ({ editor, range }) =>
          insertBlock(editor, range, null, (chain) => chain.setHeading({ level: 2 })),
      },
      {
        label: "项目列表",
        keywords: "bullet list 列表",
        icon: "•",
        description: "无序列表",
        command: ({ editor, range }) =>
          insertBlock(editor, range, null, (chain) => chain.toggleBulletList()),
      },
      {
        label: "编号列表",
        keywords: "ordered list 数字",
        icon: "1.",
        description: "有序列表",
        command: ({ editor, range }) =>
          insertBlock(editor, range, null, (chain) => chain.toggleOrderedList()),
      },
      {
        label: "引用",
        keywords: "quote 引用",
        icon: "❝",
        description: "突出引用内容",
        command: ({ editor, range }) =>
          insertBlock(editor, range, null, (chain) => chain.toggleBlockquote()),
      },
      {
        label: "代码块（可选语言）",
        keywords: "code 编程",
        icon: "</>",
        description: "选择语言后即时语法高亮",
        command: ({ editor, range }) =>
          insertBlock(editor, range, null, (chain) => chain.toggleCodeBlock()),
      },
      {
        label: "Callout 备注",
        keywords: "callout note 备注 提示",
        icon: "i",
        description: "带颜色的说明块",
        command: insert({
          type: "callout",
          attrs: { type: "note" },
          content: [{ type: "paragraph" }],
        }),
      },
      {
        label: "Callout 注意",
        keywords: "callout warning 注意",
        icon: "!",
        description: "需要特别关注的提示",
        command: insert({
          type: "callout",
          attrs: { type: "warning" },
          content: [{ type: "paragraph" }],
        }),
      },
      {
        label: "Mermaid 图表",
        keywords: "mermaid diagram 流程图",
        icon: "◇",
        description: "插入实时渲染的图表",
        command: insert({
          type: "mermaid",
          attrs: { chart: "flowchart TD\n  A[开始] --> B[结束]" },
        }),
      },
      {
        label: "分隔线",
        keywords: "divider horizontal rule 分割",
        icon: "—",
        description: "分隔内容区域",
        command: insert({ type: "horizontalRule" }),
      },
      {
        label: "表格",
        keywords: "table 表格",
        icon: "▦",
        description: "插入 3 × 3 表格",
        command: ({ editor, range }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run();
        },
      },
    ];
  }

  addToolbarGroup(...children) {
    const group = document.createElement("div");
    group.className = "rich-mdx-editor__toolbar-group";
    children.forEach((child) => group.append(child));
    this.toolbar.append(group);
  }

  toolbarButton(label, title, action, active) {
    const button = createIconButton(label, title);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => action());
    this.editor.on("selectionUpdate", () =>
      button.classList.toggle("is-active", Boolean(active?.())),
    );
    this.editor.on("transaction", () => button.classList.toggle("is-active", Boolean(active?.())));
    return button;
  }

  renderToolbar() {
    const heading = document.createElement("select");
    heading.setAttribute("aria-label", "文本类型");
    [
      ["paragraph", "正文"],
      ["1", "标题 1"],
      ["2", "标题 2"],
      ["3", "标题 3"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      heading.append(option);
    });
    heading.addEventListener("change", () => {
      const level = Number(heading.value);
      if (level) this.editor.chain().focus().setHeading({ level }).run();
      else this.editor.chain().focus().setParagraph().run();
    });
    this.editor.on("selectionUpdate", () => {
      const active = [1, 2, 3].find((level) => this.editor.isActive("heading", { level }));
      heading.value = active ? String(active) : "paragraph";
    });
    this.addToolbarGroup(heading);

    this.addToolbarGroup(
      this.toolbarButton(
        "B",
        "加粗",
        () => this.editor.chain().focus().toggleBold().run(),
        () => this.editor.isActive("bold"),
      ),
      this.toolbarButton(
        "I",
        "斜体",
        () => this.editor.chain().focus().toggleItalic().run(),
        () => this.editor.isActive("italic"),
      ),
      this.toolbarButton(
        "</>",
        "行内代码",
        () => this.editor.chain().focus().toggleCode().run(),
        () => this.editor.isActive("code"),
      ),
      this.toolbarButton(
        "↗",
        "插入链接",
        () => {
          const href = window.prompt("链接地址");
          if (href) this.editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
        },
        () => this.editor.isActive("link"),
      ),
    );
    this.addToolbarGroup(
      this.toolbarButton(
        "•",
        "项目列表",
        () => this.editor.chain().focus().toggleBulletList().run(),
        () => this.editor.isActive("bulletList"),
      ),
      this.toolbarButton(
        "1.",
        "编号列表",
        () => this.editor.chain().focus().toggleOrderedList().run(),
        () => this.editor.isActive("orderedList"),
      ),
      this.toolbarButton(
        "❝",
        "引用",
        () => this.editor.chain().focus().toggleBlockquote().run(),
        () => this.editor.isActive("blockquote"),
      ),
      this.toolbarButton(
        "{ }",
        "代码块",
        () => this.editor.chain().focus().toggleCodeBlock().run(),
        () => this.editor.isActive("codeBlock"),
      ),
    );

    const callout = createButton("＋ Callout", "rich-mdx-editor__secondary-button");
    callout.addEventListener("click", () => this.insertCallout("note"));
    const diagram = createButton("◇ Mermaid", "rich-mdx-editor__secondary-button");
    diagram.addEventListener("click", () => this.insertMermaid());
    const table = createButton("▦ 表格", "rich-mdx-editor__secondary-button");
    table.addEventListener("click", () =>
      this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    );
    const image = createButton("▧ 图片", "rich-mdx-editor__secondary-button");
    image.addEventListener("click", () => this.pickImage());
    this.addToolbarGroup(callout, diagram, table, image);
  }

  insertCallout(type) {
    this.editor
      .chain()
      .focus()
      .insertContent({ type: "callout", attrs: { type }, content: [{ type: "paragraph" }] })
      .run();
  }

  insertMermaid() {
    this.editor
      .chain()
      .focus()
      .insertContent({
        type: "mermaid",
        attrs: {
          chart:
            "flowchart TD\n  A[开始] --> B{满足条件吗？}\n  B -- 是 --> C[继续]\n  B -- 否 --> D[结束]",
        },
      })
      .run();
  }

  destroy() {
    this.editor?.destroy();
    document.removeEventListener("mousedown", this.closeBlockMenu);
    this.blockMenu?.remove();
    this.element.replaceChildren();
  }
}

window.MdxRichEditor = MdxRichEditor;
