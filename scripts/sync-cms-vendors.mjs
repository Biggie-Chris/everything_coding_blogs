import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targetDirectory = resolve(repositoryRoot, "public/admin/vendor");
const distributionDirectory = resolve(repositoryRoot, "dist/admin/vendor");
const assets = [
  ["node_modules/marked/lib/marked.umd.js", "marked.umd.js"],
  ["node_modules/dompurify/dist/purify.min.js", "purify.min.js"],
  ["node_modules/mermaid/dist/mermaid.min.js", "mermaid.min.js"],
];

await mkdir(targetDirectory, { recursive: true });
await Promise.all(
  assets.map(([source, filename]) =>
    copyFile(resolve(repositoryRoot, source), resolve(targetDirectory, filename)),
  ),
);

await build({ configFile: resolve(repositoryRoot, "scripts/vite.cms-editor.config.mjs") });

if (process.argv.includes("--copy-to-dist")) {
  await mkdir(distributionDirectory, { recursive: true });
  await Promise.all(
    [...assets.map(([, filename]) => filename), "rich-mdx-editor.js"].map((filename) =>
      copyFile(resolve(targetDirectory, filename), resolve(distributionDirectory, filename)),
    ),
  );
}
