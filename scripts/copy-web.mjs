import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const distDir = join(root, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const filesToCopy = [
  "index.html",
  "style.css",
  "script.js",
  "manifest.webmanifest",
  "sw.js"
];

for (const file of filesToCopy) {
  cpSync(join(root, file), join(distDir, file));
}

if (existsSync(join(root, "icons"))) {
  cpSync(join(root, "icons"), join(distDir, "icons"), { recursive: true });
}
