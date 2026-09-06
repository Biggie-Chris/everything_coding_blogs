import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targetDirectory = resolve(repositoryRoot, "public/admin/vendor");
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
