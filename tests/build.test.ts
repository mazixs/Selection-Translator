import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { RUNTIME_ASSETS } from "../scripts/runtime-assets.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const runtimeAssets: readonly string[] = RUNTIME_ASSETS;

// Rendered or listing-only files: they live in assets/ but the extension never loads them.
const SOURCE_ONLY_ASSETS = ["assets/icon-16.svg", "assets/icon-1024.png"];

const SOURCE_DIRECTORIES = ["src", "options", "popup"];
const SOURCE_EXTENSIONS = [".ts", ".html", ".css"];
const ASSET_REFERENCE = /assets\/[\w.-]+/g;

type ManifestAssets = {
  icons: Record<string, string>;
  action: { default_icon: Record<string, string> };
  web_accessible_resources: Array<{ resources: string[] }>;
};

function readProjectFile(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assetsFromManifest(): string[] {
  const manifest = JSON.parse(readProjectFile("manifest.json")) as ManifestAssets;

  return [
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.web_accessible_resources.flatMap(({ resources }) => resources),
  ];
}

function assetsFromSources(): string[] {
  return SOURCE_DIRECTORIES.flatMap((directory) =>
    readdirSync(join(ROOT, directory), { recursive: true, encoding: "utf8" })
      .filter((name) => SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)))
      .flatMap(
        (name) => readProjectFile(join(directory, name)).match(ASSET_REFERENCE) ?? [],
      ),
  );
}

function unique(paths: string[]): string[] {
  return [...new Set(paths)].sort();
}

test("build copies exactly the assets the manifest and the sources reference", () => {
  const referenced = unique([...assetsFromManifest(), ...assetsFromSources()]);

  assert.deepEqual(unique([...runtimeAssets]), referenced);
});

test("every runtime asset exists in assets/", () => {
  for (const asset of RUNTIME_ASSETS) {
    assert.equal(existsSync(join(ROOT, asset)), true, `${asset} is missing`);
  }
});

test("every file in assets/ is either a runtime asset or a known source-only one", () => {
  const onDisk = readdirSync(join(ROOT, "assets")).map((name) => `assets/${name}`);

  assert.deepEqual(unique(onDisk), unique([...runtimeAssets, ...SOURCE_ONLY_ASSETS]));
  for (const asset of SOURCE_ONLY_ASSETS) {
    assert.equal(runtimeAssets.includes(asset), false, `${asset} must not ship`);
  }
});

test("build script copies the runtime asset list instead of the whole assets directory", () => {
  const buildScript = readProjectFile("scripts/build.ts");

  assert.equal(buildScript.includes("RUNTIME_ASSETS"), true);
  assert.equal(/copyProjectFile\(\s*["']assets["']\s*\)/.test(buildScript), false);
});
