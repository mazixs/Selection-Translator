import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

function readManifest() {
  return JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
}

test("manifest is Manifest V3 and references existing extension files", () => {
  const manifest = readManifest();

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.equal(existsSync(join(ROOT, manifest.background.service_worker)), true);
  assert.equal(existsSync(join(ROOT, manifest.options_page)), true);
  assert.equal(existsSync(join(ROOT, manifest.action.default_popup)), true);

  for (const script of manifest.content_scripts[0].js) {
    assert.equal(existsSync(join(ROOT, script)), true);
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
  assert.deepEqual(hostPermissions.toSorted(), [
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
