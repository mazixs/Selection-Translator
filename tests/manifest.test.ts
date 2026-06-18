import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

type ExtensionManifest = {
  manifest_version: number;
  background: {
    service_worker: string;
  };
  options_page: string;
  action: {
    default_popup: string;
    default_icon: Record<string, string>;
  };
  content_scripts: [
    {
      js: string[];
      css: string[];
      matches: string[];
    },
  ];
  icons: Record<string, string>;
  permissions: string[];
  host_permissions: string[];
  optional_host_permissions: string[];
  web_accessible_resources: Array<{
    resources: string[];
    matches: string[];
  }>;
};

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")) as ExtensionManifest;
}

function sourcePathForBuiltScript(scriptPath: string): string {
  return scriptPath.replace(/\.js$/, ".ts");
}

test("manifest is Manifest V3 and references existing extension files", () => {
  const manifest = readManifest();

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(
    existsSync(join(ROOT, sourcePathForBuiltScript(manifest.background.service_worker))),
    true,
  );
  assert.equal(existsSync(join(ROOT, manifest.options_page)), true);
  assert.equal(existsSync(join(ROOT, manifest.action.default_popup)), true);

  for (const script of manifest.content_scripts[0].js) {
    assert.equal(existsSync(join(ROOT, sourcePathForBuiltScript(script))), true);
  }

  for (const stylesheet of manifest.content_scripts[0].css) {
    assert.equal(existsSync(join(ROOT, stylesheet)), true);
  }

  for (const iconPath of Object.values(manifest.icons)) {
    assert.equal(existsSync(join(ROOT, iconPath)), true);
  }

  for (const iconPath of Object.values(manifest.action.default_icon)) {
    assert.equal(existsSync(join(ROOT, iconPath)), true);
  }
});

test("manifest includes permissions needed for storage, context menu, and provider fetches", () => {
  const manifest = readManifest();
  const hostPermissions = manifest.host_permissions;

  assert.equal(manifest.permissions.includes("storage"), true);
  assert.equal(manifest.permissions.includes("contextMenus"), true);
  assert.equal(
    manifest.permissions.includes("declarativeNetRequestWithHostAccess"),
    true,
  );
  assert.equal(hostPermissions.includes("<all_urls>"), false);
  assert.deepEqual([...hostPermissions].sort(), [
    "https://translate.api.cloud.yandex.net/*",
    "https://translate.googleapis.com/*",
    "https://translate.yandex.net/*",
    "https://translate.yandex.ru/*",
  ]);
  assert.deepEqual(manifest.optional_host_permissions, [
    "http://*/*",
    "https://*/*",
  ]);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "http://*/*",
    "https://*/*",
  ]);
});

test("manifest exposes the content-script icon asset", () => {
  const manifest = readManifest();

  assert.deepEqual(manifest.icons, {
    16: "assets/icon-16.png",
    32: "assets/icon-32.png",
    48: "assets/icon-48.png",
    128: "assets/icon-128.png",
  });
  assert.deepEqual(manifest.action.default_icon, manifest.icons);
  assert.deepEqual(manifest.web_accessible_resources, [
    {
      resources: ["assets/icon-32.png"],
      matches: ["http://*/*", "https://*/*"],
    },
  ]);
});
