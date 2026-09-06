import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export default defineConfig({
  // The bundle itself is emitted under public/admin/vendor; copying Vite's
  // project-wide public folder here would recursively copy the output folder.
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(repositoryRoot, "src/cms-editor/rich-mdx-editor.js"),
      formats: ["iife"],
      name: "RichMdxEditorBundle",
      fileName: () => "rich-mdx-editor.js",
    },
    outDir: resolve(repositoryRoot, "public/admin/vendor"),
    sourcemap: false,
  },
});
