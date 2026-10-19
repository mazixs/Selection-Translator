import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { getManifestLocaleFiles } from "./manifest-locales.js";
import { RUNTIME_ASSETS } from "./runtime-assets.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");

async function writeDistFile(path: string, content: string) {
  const to = join(DIST, path);
  await mkdir(dirname(to), { recursive: true });
  await writeFile(to, content);
}

async function copyProjectFile(path: string) {
  const from = join(ROOT, path);
  const to = join(DIST, path);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

await Promise.all([
  copyProjectFile("manifest.json"),
  copyProjectFile("README.md"),
  copyProjectFile("README.ru.md"),
  copyProjectFile("LICENSE"),
  ...RUNTIME_ASSETS.map(copyProjectFile),
  copyProjectFile("src/content.css"),
  copyProjectFile("options/options.html"),
  copyProjectFile("options/options.css"),
  copyProjectFile("popup/popup.html"),
  copyProjectFile("popup/popup.css"),
  ...getManifestLocaleFiles().map(({ path, content }) => writeDistFile(path, content)),
]);

await build({
  entryPoints: {
    "src/background": join(ROOT, "src/background.ts"),
  },
  outdir: DIST,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome123",
});

await build({
  entryPoints: {
    "src/content": join(ROOT, "src/content.ts"),
  },
  outdir: DIST,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome123",
});

await build({
  entryPoints: {
    "options/options": join(ROOT, "options/options.ts"),
    "popup/popup": join(ROOT, "popup/popup.ts"),
  },
  outdir: DIST,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome123",
});
