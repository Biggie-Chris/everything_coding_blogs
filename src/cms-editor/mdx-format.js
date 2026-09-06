import { marked } from "marked";

export const MDX_COMPONENT_IMPORTS = {
  Callout: 'import Callout from "@components/post/Callout.astro";',
  Figure: 'import Figure from "@components/post/Figure.astro";',
  Mermaid: 'import Mermaid from "@components/post/Mermaid.astro";',
};

const SUPPORTED_COMPONENTS = new Set(Object.keys(MDX_COMPONENT_IMPORTS));
const IMPORT_LINE = /^import\s+([A-Za-z_$][\w$]*)\s+from\s+["'][^"']+["'];?\s*$/gm;
const SPECIAL_COMPONENT =
  /<Callout\b([\s\S]*?)>([\s\S]*?)<\/Callout\s*>|<Figure\b([\s\S]*?)\/\s*>|<Mermaid\b([\s\S]*?)\/\s*>/g;
const UNKNOWN_COMPONENT =
  /<([A-Z][A-Za-z0-9_$]*)\b(?:[^>"']|"[^"]*"|'[^']*')*(?:\/>|>[\s\S]*?<\/\1\s*>)/g;
const STANDALONE_MARKDOWN_IMAGE =
  /^[ \t]*!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)[ \t]*$/gm;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function encodeAttribute(value) {
  return encodeURIComponent(String(value ?? ""));
}

function decodeAttribute(value) {
  try {
    return decodeURIComponent(value || "");
  } catch {
    return value || "";
  }
}

export function getMdxProp(attributes, name) {
  const attributeSource = String(attributes || "");
  const backtick = String.fromCharCode(96);
  const template = new RegExp(`${name}\\s*=\\s*\\{${backtick}([\\s\\S]*?)${backtick}\\}`).exec(
    attributeSource,
  );
  if (template) return template[1];

  const quoted = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`).exec(attributeSource);
  return quoted ? quoted[1] : "";
}

function splitImports(source) {
  const unknownImports = [];
  const markdown = source.replace(IMPORT_LINE, (line, componentName) => {
    if (!SUPPORTED_COMPONENTS.has(componentName)) unknownImports.push(line.trim());
    return "";
  });
  return { markdown, unknownImports };
}

function rawBlockHtml(source) {
  return `<div data-mdx-raw="true" data-source="${encodeAttribute(source)}"></div>`;
}

function figureBlockHtml({ src, alt, caption = "" }) {
  return `<figure data-mdx-figure="true" data-src="${encodeAttribute(src)}" data-alt="${encodeAttribute(alt)}" data-caption="${encodeAttribute(caption)}"></figure>`;
}

function replaceUnknownMdx(source) {
  return source.replace(UNKNOWN_COMPONENT, (component) => rawBlockHtml(component));
}

function replaceStandaloneMarkdownImages(source) {
  return source.replace(STANDALONE_MARKDOWN_IMAGE, (_image, alt, src, caption) =>
    figureBlockHtml({ alt, caption, src }),
  );
}

function renderMarkdown(source) {
  if (!source.trim()) return "";
  return marked.parse(replaceUnknownMdx(replaceStandaloneMarkdownImages(source)), {
    breaks: false,
    gfm: true,
  });
}

/**
 * Converts the project-supported MDX subset into semantic HTML that Tiptap can
 * parse. Unknown JSX is represented as an atomic raw-MDX node, so saving an
 * existing post cannot silently discard a component the visual editor does not
 * understand yet.
 */
export function mdxToEditorHtml(source, sanitize = (html) => html) {
  const { markdown, unknownImports } = splitImports(String(source || ""));
  const parts = unknownImports.map(rawBlockHtml);
  let lastIndex = 0;
  let match;

  while ((match = SPECIAL_COMPONENT.exec(markdown))) {
    parts.push(renderMarkdown(markdown.slice(lastIndex, match.index)));

    if (typeof match[2] === "string") {
      const type = getMdxProp(match[1], "type") || "note";
      parts.push(
        `<section data-mdx-callout="true" data-type="${escapeHtml(type)}">${renderMarkdown(match[2].trim())}</section>`,
      );
    } else if (typeof match[3] === "string") {
      parts.push(
        figureBlockHtml({
          src: getMdxProp(match[3], "src"),
          alt: getMdxProp(match[3], "alt"),
          caption: getMdxProp(match[3], "caption"),
        }),
      );
    } else {
      parts.push(
        `<div data-mdx-mermaid="true" data-chart="${encodeAttribute(getMdxProp(match[4], "chart"))}"></div>`,
      );
    }
    lastIndex = SPECIAL_COMPONENT.lastIndex;
  }

  parts.push(renderMarkdown(markdown.slice(lastIndex)));
  return sanitize(parts.filter(Boolean).join("\n"));
}

function serializeInline(nodes = []) {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "  \n";
      if (node.type !== "text") return "";

      let text = node.text || "";
      for (const mark of node.marks || []) {
        if (mark.type === "code") text = `\`${text.replaceAll("`", "\\`")}\``;
        if (mark.type === "bold") text = `**${text}**`;
        if (mark.type === "italic") text = `*${text}*`;
        if (mark.type === "strike") text = `~~${text}~~`;
        if (mark.type === "link") {
          const href = mark.attrs?.href || "";
          const title = mark.attrs?.title ? ` \"${mark.attrs.title}\"` : "";
          text = `[${text}](${href}${title})`;
        }
      }
      return text;
    })
    .join("");
}

function indentLines(value, prefix) {
  return value
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}

function serializeList(node, context) {
  const ordered = node.type === "orderedList";
  const start = Number(node.attrs?.start || 1);
  return (node.content || [])
    .map((item, index) => {
      const children = item.content || [];
      const paragraph = children.find((child) => child.type === "paragraph");
      const nested = children.filter(
        (child) => child.type === "bulletList" || child.type === "orderedList",
      );
      const marker = ordered ? `${start + index}.` : "-";
      const firstLine = `${marker} ${serializeInline(paragraph?.content)}`.trimEnd();
      const nestedText = nested
        .map((child) => indentLines(serializeList(child, context), "  "))
        .filter(Boolean)
        .join("\n");
      return nestedText ? `${firstLine}\n${nestedText}` : firstLine;
    })
    .join("\n");
}

function serializeTable(node) {
  const rows = node.content || [];
  if (!rows.length) return "";
  const renderRow = (row) =>
    (row.content || [])
      .map((cell) => serializeInline(cell.content?.[0]?.content).replaceAll("|", "\\|"))
      .join(" | ");
  const header = renderRow(rows[0]);
  const cellCount = Math.max(1, rows[0].content?.length || 1);
  const divider = Array.from({ length: cellCount }, () => "---").join(" | ");
  const body = rows.slice(1).map(renderRow);
  return [`| ${header} |`, `| ${divider} |`, ...body.map((row) => `| ${row} |`)].join("\n");
}

function serializeNode(node, context) {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content);
    case "heading":
      return `${"#".repeat(Math.min(6, Math.max(1, Number(node.attrs?.level || 2))))} ${serializeInline(node.content)}`;
    case "bulletList":
    case "orderedList":
      return serializeList(node, context);
    case "blockquote":
      return indentLines(serializeNodes(node.content, context), "> ");
    case "codeBlock": {
      const language = node.attrs?.language || "";
      const code = serializeInline(node.content);
      const fence = code.includes("```") ? "````" : "```";
      return `${fence}${language}\n${code}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    case "image": {
      const alt = node.attrs?.alt || "图片";
      const src = node.attrs?.src || "";
      const title = node.attrs?.title ? ` \"${node.attrs.title}\"` : "";
      return `![${alt}](${src}${title})`;
    }
    case "table":
      return serializeTable(node);
    case "callout": {
      context.components.add("Callout");
      const type = node.attrs?.type || "note";
      const content = serializeNodes(node.content, context);
      return `<Callout type="${type}">\n${content}\n</Callout>`;
    }
    case "figure": {
      context.components.add("Figure");
      const src = node.attrs?.src || "";
      const alt = node.attrs?.alt || "图片说明";
      const caption = node.attrs?.caption || "";
      return [
        "<Figure",
        `  src="${src.replaceAll('"', "&quot;")}"`,
        `  alt="${alt.replaceAll('"', "&quot;")}"`,
        caption ? `  caption="${caption.replaceAll('"', "&quot;")}"` : "",
        "/>",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "mermaid": {
      context.components.add("Mermaid");
      const chart = String(node.attrs?.chart || "")
        .replaceAll("`", "\\`")
        .replaceAll("${", "\\${");
      return `<Mermaid chart={\`${chart}\`} />`;
    }
    case "rawMdx":
      return node.attrs?.source || "";
    default:
      return serializeInline(node.content);
  }
}

function serializeNodes(nodes = [], context) {
  return nodes
    .map((node) => serializeNode(node, context).trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Serializes Tiptap JSON back to the Markdown / MDX format published by Astro. */
export function editorJsonToMdx(document) {
  const context = { components: new Set() };
  const body = serializeNodes(document?.content, context).trim();
  const imports = [...context.components].map((component) => MDX_COMPONENT_IMPORTS[component]);
  return [...imports, body].filter(Boolean).join("\n\n").trimEnd() + "\n";
}

export const __private__ = { decodeAttribute, encodeAttribute, replaceUnknownMdx };
