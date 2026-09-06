/* global CMS */

(function registerRichMdxWidget() {
  "use strict";

  if (!window.CMS) return;
  if (!window.CMS.createClass && window.createClass) window.CMS.createClass = window.createClass;
  if (!window.CMS.h && window.h) window.CMS.h = window.h;
  if (!window.CMS.createClass || !window.CMS.h) {
    window.console.error("Decap CMS custom widget API is unavailable.");
    return;
  }

  var MdxRichControl = CMS.createClass({
    componentDidMount: function componentDidMount() {
      if (!window.MdxRichEditor) {
        this.setState({ error: "可视化编辑器没有加载成功，请刷新页面后重试。" });
        return;
      }
      this.editor = new window.MdxRichEditor({
        element: document.getElementById(this.props.forID + "-rich-editor"),
        getAsset: this.props.getAsset,
        onAddAsset: this.props.onAddAsset,
        onChange: this.props.onChange,
        value: this.props.value || "",
      });
    },
    componentDidUpdate: function componentDidUpdate() {
      this.editor && this.editor.updateValue(this.props.value || "");
    },
    componentWillUnmount: function componentWillUnmount() {
      this.editor && this.editor.destroy();
    },
    render: function render() {
      if (this.state && this.state.error) {
        return CMS.h("p", { className: "rich-mdx-editor__load-error" }, this.state.error);
      }
      return CMS.h("div", { className: "rich-mdx-editor-shell" }, [
        CMS.h(
          "p",
          { className: "rich-mdx-editor__hint", key: "hint" },
          "直接在正文中编辑；输入 / 可插入不同内容块。粘贴或选择图片后，图片会与文章一起提交。",
        ),
        CMS.h("div", { id: this.props.forID + "-rich-editor", key: "editor" }),
      ]);
    },
  });

  CMS.registerWidget("mdx_paste", MdxRichControl);
})();
