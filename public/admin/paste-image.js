/* global CMS */

(function registerMdxPasteWidget() {
  "use strict";

  // Decap 的 CDN 构建把 createClass 和 h 暴露为全局函数；保留 CMS 上的
  // 回退路径，兼容以后可能调整的构建方式。
  if (!window.CMS) return;
  if (!window.CMS.createClass && window.createClass) window.CMS.createClass = window.createClass;
  if (!window.CMS.h && window.h) window.CMS.h = window.h;
  if (!window.CMS.createClass || !window.CMS.h) {
    window.console.error("Decap CMS custom widget API is unavailable.");
    return;
  }

  var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  var MEDIA_FOLDER = "src/content/blog/uploads";
  var PUBLIC_FOLDER = "../uploads";
  var MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11.12.1/dist/mermaid.min.js";
  var MARKED_CDN = "https://cdn.jsdelivr.net/npm/marked@16.4.2/lib/marked.umd.js";
  var DOMPURIFY_CDN = "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js";
  var mermaidLoader;
  var markdownRendererLoader;
  var mermaidId = 0;
  var MIME_EXTENSIONS = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  var CALLOUT_LABELS = { note: "备注", tip: "提示", warning: "注意", danger: "警告" };

  function getPastedImage(event) {
    var clipboard = event.clipboardData;
    if (!clipboard || !clipboard.items) return null;
    for (var index = 0; index < clipboard.items.length; index += 1) {
      var item = clipboard.items[index];
      if (item.kind === "file" && MIME_EXTENSIONS[item.type]) return item.getAsFile();
    }
    return null;
  }

  function buildFilename(file) {
    var extension = MIME_EXTENSIONS[file.type] || "png";
    var timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
    return "pasted-" + timestamp + "." + extension;
  }

  function insertAtSelection(value, input, text) {
    var start = typeof input.selectionStart === "number" ? input.selectionStart : value.length;
    var end = typeof input.selectionEnd === "number" ? input.selectionEnd : start;
    return value.slice(0, start) + text + value.slice(end);
  }

  function ensureMdxImports(value, components) {
    var missing = components.filter(function (component) {
      return !new RegExp("import\\s+" + component + "\\s+from\\s+[\\\"']").test(value);
    });
    if (missing.length === 0) return { value: value, added: false };
    var imports = missing
      .map(function (component) {
        return "import " + component + ' from "@components/post/' + component + '.astro";';
      })
      .join("\n");

    if (value.slice(0, 3) === "---") {
      var closingFrontmatter = value.indexOf("\n---", 3);
      if (closingFrontmatter !== -1) {
        var insertionPoint = closingFrontmatter + 4;
        return {
          value: value.slice(0, insertionPoint) + "\n\n" + imports + value.slice(insertionPoint),
          added: true,
        };
      }
    }
    return { value: imports + "\n\n" + value, added: true };
  }

  function getMdxProp(attributes, name) {
    var marker = String.fromCharCode(96);
    var template = new RegExp(
      name + "\\s*=\\s*\\{" + marker + "([\\s\\S]*?)" + marker + "\\}",
    ).exec(attributes);
    if (template) return template[1];
    var quoted = new RegExp(name + "\\s*=\\s*[\\\"']([^\\\"']*)[\\\"']").exec(attributes);
    return quoted ? quoted[1] : "";
  }

  function injectStyles() {
    if (document.getElementById("mdx-paste-control-styles")) return;
    var style = document.createElement("style");
    style.id = "mdx-paste-control-styles";
    style.textContent = [
      ".mdx-paste-control__toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}",
      ".mdx-paste-control__toolbar button{border:1px solid #8a9aa5;border-radius:4px;background:#fff;color:#21313c;cursor:pointer;font:inherit;font-size:13px;padding:7px 10px}",
      ".mdx-paste-control__toolbar button:hover{background:#edf4f7}",
      ".mdx-paste-control__hint{margin:0 0 10px;color:#52636e;font-size:13px;line-height:1.5}",
      ".mdx-paste-control textarea{box-sizing:border-box;display:block;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.55;width:100%}",
      ".mdx-paste-control__preview{border:1px solid #d5dde2;border-radius:6px;margin-top:16px;overflow:hidden}",
      ".mdx-paste-control__preview-title{background:#f4f7f8;border-bottom:1px solid #d5dde2;color:#33454f;font-size:13px;font-weight:600;margin:0;padding:9px 12px}",
      ".mdx-paste-control__preview-body{background:#fff;padding:16px}",
      ".mdx-paste-control__text{color:#33454f;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap}",
      ".mdx-paste-control__markdown{color:#253743;font-size:14px;line-height:1.75}",
      ".mdx-paste-control__markdown h1,.mdx-paste-control__markdown h2,.mdx-paste-control__markdown h3{color:#1b2b34;line-height:1.3;margin:24px 0 12px}",
      ".mdx-paste-control__markdown h1{font-size:24px}.mdx-paste-control__markdown h2{font-size:20px}.mdx-paste-control__markdown h3{font-size:17px}",
      ".mdx-paste-control__markdown p,.mdx-paste-control__markdown ul,.mdx-paste-control__markdown ol{margin:12px 0}",
      ".mdx-paste-control__markdown li+li{margin-top:4px}",
      ".mdx-paste-control__markdown pre{background:#17232b;border-radius:5px;color:#e8f0f2;overflow:auto;padding:12px}",
      ".mdx-paste-control__markdown code{background:#edf2f4;border-radius:3px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.9em;padding:1px 4px}",
      ".mdx-paste-control__markdown pre code{background:transparent;padding:0}",
      ".mdx-paste-control__markdown blockquote{border-left:3px solid #89a7b7;color:#50636e;margin:12px 0;padding-left:12px}",
      ".mdx-paste-control__markdown table{border-collapse:collapse;display:block;max-width:100%;overflow:auto}",
      ".mdx-paste-control__markdown td,.mdx-paste-control__markdown th{border:1px solid #d5dde2;padding:6px 8px;text-align:left}",
      ".mdx-paste-control__callout{border-left:4px solid #4a78a8;border-radius:4px;background:#edf4fb;margin:12px 0;padding:12px 14px}",
      ".mdx-paste-control__callout--tip{border-left-color:#27866c;background:#edf8f4}",
      ".mdx-paste-control__callout--warning{border-left-color:#b7791f;background:#fff8e6}",
      ".mdx-paste-control__callout--danger{border-left-color:#c64b4b;background:#fff0f0}",
      ".mdx-paste-control__callout-label{display:block;font-size:12px;font-weight:700;margin-bottom:5px;text-transform:uppercase}",
      ".mdx-paste-control__callout-content{color:#33454f;font-size:14px;line-height:1.6;white-space:pre-wrap}",
      ".mdx-paste-control__figure{border:1px solid #d5dde2;border-radius:6px;margin:12px 0;padding:12px;text-align:center}",
      ".mdx-paste-control__figure img{border-radius:4px;display:block;height:auto;max-height:360px;max-width:100%;margin:0 auto}",
      ".mdx-paste-control__figure figcaption{color:#61717a;font-size:13px;margin-top:8px}",
      ".mdx-paste-control__mermaid{background:#fafcfd;border:1px solid #d5dde2;border-radius:6px;margin:12px 0;min-height:56px;overflow:auto;padding:12px;text-align:center}",
      ".mdx-paste-control__mermaid code{color:#33454f;display:block;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;text-align:left;white-space:pre}",
      ".mdx-paste-control__mermaid-error{color:#9b2c2c;font-size:13px;text-align:left}",
    ].join("");
    document.head.appendChild(style);
  }

  function loadExternalScript(source, isReady) {
    if (isReady()) return Promise.resolve();

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = source;
      script.async = true;
      script.onload = function () {
        if (isReady()) resolve();
        else reject(new Error("Preview dependency loaded without an API."));
      };
      script.onerror = function () {
        reject(new Error("Unable to load preview dependency."));
      };
      document.head.appendChild(script);
    });
  }

  function loadMarkdownRenderer() {
    if (window.marked && window.DOMPurify) return Promise.resolve();
    if (markdownRendererLoader) return markdownRendererLoader;

    markdownRendererLoader = Promise.all([
      loadExternalScript(MARKED_CDN, function () {
        return Boolean(window.marked && window.marked.parse);
      }),
      loadExternalScript(DOMPURIFY_CDN, function () {
        return Boolean(window.DOMPurify && window.DOMPurify.sanitize);
      }),
    ]);
    return markdownRendererLoader;
  }

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (mermaidLoader) return mermaidLoader;
    mermaidLoader = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = MERMAID_CDN;
      script.async = true;
      script.onload = function () {
        if (window.mermaid) resolve(window.mermaid);
        else reject(new Error("Mermaid script loaded without an API."));
      };
      script.onerror = function () {
        reject(new Error("Unable to load Mermaid."));
      };
      document.head.appendChild(script);
    });
    return mermaidLoader;
  }

  function renderMermaidPreview(element) {
    var source = element.getAttribute("data-mermaid-source") || "";
    if (!source || element.getAttribute("data-mermaid-rendered") === source) return;
    element.setAttribute("data-mermaid-rendered", source);
    element.textContent = "正在渲染 Mermaid 图表…";
    loadMermaid()
      .then(function (mermaid) {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        mermaidId += 1;
        return mermaid.render("cms-mermaid-" + mermaidId, source);
      })
      .then(function (result) {
        if (element.getAttribute("data-mermaid-rendered") === source)
          element.innerHTML = result.svg;
      })
      .catch(function () {
        if (element.getAttribute("data-mermaid-rendered") === source) {
          element.innerHTML =
            '<div class="mdx-paste-control__mermaid-error">Mermaid 语法无效，或预览脚本暂时不可用。</div>';
        }
      });
  }

  var MdxPasteControl = CMS.createClass({
    getInitialState: function getInitialState() {
      return { markdownPreviewReady: false, previewVisible: true };
    },
    componentDidMount: function componentDidMount() {
      injectStyles();
      this.loadMarkdownPreview();
      this.scheduleMermaidPreview();
    },
    componentDidUpdate: function componentDidUpdate() {
      this.scheduleMermaidPreview();
    },
    scheduleMermaidPreview: function scheduleMermaidPreview() {
      window.setTimeout(function () {
        Array.prototype.forEach.call(
          document.querySelectorAll(".mdx-paste-control__mermaid[data-mermaid-source]"),
          renderMermaidPreview,
        );
      }, 0);
    },
    loadMarkdownPreview: function loadMarkdownPreview() {
      var control = this;
      loadMarkdownRenderer()
        .then(function () {
          control.setState({ markdownPreviewReady: true });
        })
        .catch(function () {
          // 保留安全的原文回退；网络问题不应影响正文编辑或发布。
          control.setState({ markdownPreviewReady: false });
        });
    },
    handleChange: function handleChange(event) {
      this.props.onChange(event.target.value);
    },

    handlePaste: function handlePaste(event) {
      var file = getPastedImage(event);
      if (!file) return;
      if (file.size > MAX_IMAGE_SIZE) {
        window.alert("粘贴的图片不能超过 10 MB。");
        return;
      }
      if (typeof this.props.onAddAsset !== "function") {
        window.alert("图片暂存功能尚未就绪，请刷新页面后重试。");
        return;
      }
      event.preventDefault();
      var filename = buildFilename(file);
      this.props.onAddAsset({
        file: file,
        name: filename,
        path: MEDIA_FOLDER + "/" + filename,
      });
      this.props.onChange(
        insertAtSelection(
          this.props.value || "",
          event.target,
          "![粘贴的图片](" + PUBLIC_FOLDER + "/" + filename + ")",
        ),
      );
    },

    insertTemplate: function insertTemplate(template, components) {
      var input = document.getElementById(this.props.forID);
      var currentValue = this.props.value || "";
      var prepared = ensureMdxImports(currentValue, components);
      var nextValue = prepared.added
        ? prepared.value.replace(/\s*$/, "") + "\n\n" + template + "\n"
        : insertAtSelection(currentValue, input || {}, template);
      this.props.onChange(nextValue);
      window.setTimeout(function () {
        if (input) input.focus();
      }, 0);
    },
    insertCallout: function insertCallout(type) {
      this.insertTemplate(
        '<Callout type="' + type + '">\n在这里填写' + CALLOUT_LABELS[type] + "内容。\n</Callout>",
        ["Callout"],
      );
    },
    insertFigure: function insertFigure() {
      this.insertTemplate(
        '<Figure\n  src="../uploads/图片文件.png"\n  alt="图片说明"\n  caption="可选图片说明"\n/>',
        ["Figure"],
      );
    },
    insertMermaid: function insertMermaid() {
      var backtick = String.fromCharCode(96);
      this.insertTemplate(
        "<Mermaid\n  chart={" +
          backtick +
          "\nflowchart TD\n  A[开始] --> B{满足条件吗？}\n  B -- 是 --> C[继续]\n  B -- 否 --> D[结束]\n  " +
          backtick +
          "}\n/>",
        ["Mermaid"],
      );
    },
    togglePreview: function togglePreview() {
      this.setState({ previewVisible: !this.state.previewVisible });
    },

    renderMarkdownPreview: function renderMarkdownPreview(source, key) {
      var withoutImports = source.replace(
        /^import\s+[A-Za-z_$][\w$]*\s+from\s+["'][^"']+["'];?\s*$/gm,
        "",
      );

      if (!this.state.markdownPreviewReady) {
        return CMS.h(
          "div",
          { className: "mdx-paste-control__text", key: key },
          withoutImports || "正在加载 Markdown 预览…",
        );
      }

      var renderedHtml = window.marked.parse(withoutImports, {
        breaks: false,
        gfm: true,
      });
      var safeHtml = window.DOMPurify.sanitize(renderedHtml, {
        FORBID_ATTR: ["style"],
        USE_PROFILES: { html: true },
      });

      return CMS.h("div", {
        className: "mdx-paste-control__markdown",
        dangerouslySetInnerHTML: { __html: safeHtml },
        key: key,
      });
    },

    renderFigurePreview: function renderFigurePreview(attributes, key) {
      var source = getMdxProp(attributes, "src");
      var alt = getMdxProp(attributes, "alt") || "图片";
      var caption = getMdxProp(attributes, "caption");
      var imageSource = source;
      if (source && typeof this.props.getAsset === "function") {
        try {
          imageSource = this.props.getAsset(source) || source;
        } catch (error) {
          imageSource = source;
        }
      }
      return CMS.h("figure", { className: "mdx-paste-control__figure", key: key }, [
        source
          ? CMS.h("img", { alt: alt, key: "image", src: imageSource })
          : CMS.h("div", { key: "missing" }, "请填写 Figure 的 src。"),
        caption && CMS.h("figcaption", { key: "caption" }, caption),
      ]);
    },

    renderPreview: function renderPreview() {
      var value = this.props.value || "";
      var blocks = [];
      var expression =
        /<Callout\b([\s\S]*?)>([\s\S]*?)<\/Callout>|<Figure\b([\s\S]*?)\/>|<Mermaid\b([\s\S]*?)\/>/g;
      var match;
      var previousIndex = 0;
      var blockNumber = 0;
      while ((match = expression.exec(value))) {
        var textBefore = value.slice(previousIndex, match.index).trim();
        if (textBefore) {
          blocks.push(this.renderMarkdownPreview(textBefore, "text-" + blockNumber));
          blockNumber += 1;
        }
        if (typeof match[2] === "string") {
          var type = getMdxProp(match[1], "type") || "note";
          if (!CALLOUT_LABELS[type]) type = "note";
          blocks.push(
            CMS.h(
              "section",
              {
                className: "mdx-paste-control__callout mdx-paste-control__callout--" + type,
                key: "callout-" + blockNumber,
              },
              [
                CMS.h(
                  "span",
                  { className: "mdx-paste-control__callout-label", key: "label" },
                  CALLOUT_LABELS[type],
                ),
                CMS.h(
                  "div",
                  { className: "mdx-paste-control__callout-content", key: "content" },
                  this.renderMarkdownPreview(match[2].trim(), "content"),
                ),
              ],
            ),
          );
        } else if (typeof match[3] === "string") {
          blocks.push(this.renderFigurePreview(match[3], "figure-" + blockNumber));
        } else {
          var chart = getMdxProp(match[4], "chart");
          blocks.push(
            CMS.h(
              "div",
              {
                className: "mdx-paste-control__mermaid",
                "data-mermaid-source": chart,
                key: "mermaid-" + blockNumber,
              },
              [CMS.h("code", { key: "source" }, chart || "请填写 Mermaid 的 chart 属性。")],
            ),
          );
        }
        previousIndex = expression.lastIndex;
        blockNumber += 1;
      }
      var remainingText = value.slice(previousIndex).trim();
      if (remainingText || blocks.length === 0) {
        blocks.push(
          this.renderMarkdownPreview(
            remainingText || "开始写作后，这里会显示受支持组件的预览。",
            "remaining",
          ),
        );
      }
      return CMS.h("section", { className: "mdx-paste-control__preview" }, [
        CMS.h("p", { className: "mdx-paste-control__preview-title", key: "title" }, "MDX 组件预览"),
        CMS.h("div", { className: "mdx-paste-control__preview-body", key: "body" }, blocks),
      ]);
    },

    render: function render() {
      var toolbar = [
        ["备注", this.insertCallout.bind(this, "note")],
        ["提示", this.insertCallout.bind(this, "tip")],
        ["注意", this.insertCallout.bind(this, "warning")],
        ["警告", this.insertCallout.bind(this, "danger")],
        ["插入 Figure", this.insertFigure],
        ["插入 Mermaid", this.insertMermaid],
        [this.state.previewVisible ? "隐藏组件预览" : "显示组件预览", this.togglePreview],
      ];
      return CMS.h("div", { className: "mdx-paste-control" }, [
        CMS.h(
          "p",
          { className: "mdx-paste-control__hint", key: "hint" },
          "支持 Markdown / GFM / MDX。可直接粘贴图片，图片会在 Publish 时与文章一起提交。",
        ),
        CMS.h(
          "div",
          { className: "mdx-paste-control__toolbar", key: "toolbar" },
          toolbar.map(function (item, index) {
            return CMS.h(
              "button",
              { key: "button-" + index, onClick: item[1], type: "button" },
              item[0],
            );
          }),
        ),
        CMS.h("textarea", {
          className: this.props.classNameWrapper,
          id: this.props.forID,
          key: "textarea",
          onChange: this.handleChange,
          onPaste: this.handlePaste,
          placeholder: "使用 Markdown / GFM / MDX 写作；可在此处直接粘贴图片。",
          rows: 28,
          spellCheck: false,
          value: this.props.value || "",
        }),
        this.state.previewVisible && this.renderPreview(),
      ]);
    },
  });
  CMS.registerWidget("mdx_paste", MdxPasteControl);
})();
