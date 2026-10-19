import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  getManifestLocaleFiles,
  getManifestMessages,
} from "../scripts/manifest-locales.js";
import { DEFAULT_LOCALE, UI_LOCALES } from "../src/i18n.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

type ExtensionManifest = {
  manifest_version: number;
  name: string;
  description: string;
  default_locale: string;
  background: {
    service_worker: string;
  };
  options_page: string;
  action: {
    default_title: string;
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
  return JSON.parse(
    readFileSync(join(ROOT, "manifest.json"), "utf8"),
  ) as ExtensionManifest;
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

test("manifest icons are PNGs of the size their key declares", () => {
  const manifest = readManifest();

  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    const png = readFileSync(join(ROOT, iconPath));
    // The IHDR chunk always comes first: width and height sit at bytes 16 and 20.
    assert.equal(png.toString("latin1", 1, 4), "PNG", iconPath);
    assert.equal(png.readUInt32BE(16), Number(size), iconPath);
    assert.equal(png.readUInt32BE(20), Number(size), iconPath);
  }
});

test("manifest includes permissions needed for storage, context menu, and provider fetches", () => {
  const manifest = readManifest();
  const hostPermissions = manifest.host_permissions;

  assert.equal(manifest.permissions.includes("storage"), true);
  assert.equal(manifest.permissions.includes("contextMenus"), true);
  assert.equal(
    manifest.permissions.includes("declarativeNetRequestWithHostAccess"),
    false,
  );
  assert.equal(hostPermissions.includes("<all_urls>"), false);
  assert.deepEqual([...hostPermissions].sort(), [
    "https://clients5.google.com/*",
    "https://translate.api.cloud.yandex.net/*",
    "https://translate.googleapis.com/*",
  ]);
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
  assert.deepEqual(manifest.content_scripts[0].matches, ["http://*/*", "https://*/*"]);
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
      resources: ["assets/icon.svg"],
      matches: ["http://*/*", "https://*/*"],
    },
  ]);
});

test("manifest texts come from _locales, which the build writes from the catalogs", () => {
  const manifest = readManifest();
  const used = [manifest.name, manifest.description, manifest.action.default_title].map(
    (value) => /^__MSG_(\w+)__$/.exec(value)?.[1],
  );

  assert.equal(manifest.default_locale, DEFAULT_LOCALE);
  assert.deepEqual(used, ["extName", "extDescription", "extName"]);

  const files = getManifestLocaleFiles();
  assert.deepEqual(
    files.map(({ path }) => path),
    UI_LOCALES.map((locale) => `_locales/${locale}/messages.json`),
  );

  for (const locale of UI_LOCALES) {
    const messages = getManifestMessages(locale);

    for (const key of used) {
      assert.ok(key && messages[key]?.message, `${locale}: ${key}`);
    }
  }

  assert.equal(
    getManifestMessages("ru").extDescription?.message.includes("перевод"),
    true,
  );
});

test("localized manifest texts fit the Chrome Web Store limits", () => {
  // developer.chrome.com manifest reference: name up to 75, description up to 132.
  for (const locale of UI_LOCALES) {
    const { extName, extDescription } = getManifestMessages(locale);

    assert.ok(extName && extName.message.length <= 75, `${locale}: name`);
    assert.ok(
      extDescription && extDescription.message.length <= 132,
      `${locale}: description`,
    );
  }
});
