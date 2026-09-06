/* global CMS */

(function registerMdxPasteWidget() {
  "use strict";

  var MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  var MEDIA_FOLDER = "src/content/blog/uploads";
  var PUBLIC_FOLDER = "../uploads";
  var MIME_EXTENSIONS = {
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

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

  var MdxPasteControl = CMS.createClass({
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
      var sourcePath = MEDIA_FOLDER + "/" + filename;
      var publicPath = PUBLIC_FOLDER + "/" + filename;
      var imageMarkdown = "![粘贴的图片](" + publicPath + ")";
      var currentValue = this.props.value || "";

      this.props.onAddAsset({
        file: file,
        name: filename,
        path: sourcePath,
      });
      this.props.onChange(insertAtSelection(currentValue, event.target, imageMarkdown));
    },

    render: function render() {
      return CMS.h("div", { className: "mdx-paste-control" }, [
        CMS.h(
          "p",
          { className: "mdx-paste-control__hint", key: "hint" },
          "可直接粘贴 PNG、JPG、WebP 或 GIF 图片；图片会在 Publish 时与文章一起提交。",
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
      ]);
    },
  });

  CMS.registerWidget("mdx_paste", MdxPasteControl);
})();
