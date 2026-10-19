import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractReleaseNotes, ReleaseNotesError } from "../scripts/release-notes.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const SAMPLE = `# Журнал изменений

Вступление.

## 1.4.0 - 2026-10-19

### Добавлено

- Новое.

### Исправлено

- Починено.

## [1.3.0] - 2026-08-27

- Старое.

## 1.2.0 - 2026-08-27

### Добавлено
`;

function readJson(path: string): {
  version: string;
  packages?: Record<string, { version: string }>;
} {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function readChangelog(): string {
  return readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
}

test("extractReleaseNotes returns the body of one version without its heading", () => {
  assert.equal(
    extractReleaseNotes(SAMPLE, "1.4.0"),
    "### Добавлено\n\n- Новое.\n\n### Исправлено\n\n- Починено.",
  );
});

test("extractReleaseNotes accepts a bracketed heading and stops at the next section", () => {
  assert.equal(extractReleaseNotes(SAMPLE, "1.3.0"), "- Старое.");
});

test("extractReleaseNotes accepts CRLF line endings", () => {
  assert.equal(
    extractReleaseNotes(SAMPLE.replaceAll("\n", "\r\n"), "1.3.0"),
    "- Старое.",
  );
});

test("extractReleaseNotes fails loudly when the section is missing", () => {
  assert.throws(
    () => extractReleaseNotes(SAMPLE, "1.5.0"),
    (error) =>
      error instanceof ReleaseNotesError && /no section for 1\.5\.0/.test(error.message),
  );
  // 1.4.0 must not match a longer version that starts with it.
  assert.throws(() => extractReleaseNotes("## 1.4.01 - 2026-10-19\n\n- Нет.\n", "1.4.0"));
  assert.throws(() => extractReleaseNotes("## 11.4.0 - 2026-10-19\n\n- Нет.\n", "1.4.0"));
});

test("extractReleaseNotes fails loudly when the section is empty", () => {
  assert.throws(
    () => extractReleaseNotes(SAMPLE, "1.2.0"),
    (error) => error instanceof ReleaseNotesError && /empty/.test(error.message),
  );
  assert.throws(() =>
    extractReleaseNotes(
      "## 1.4.0 - 2026-10-19\n\n\n## 1.3.0 - 2026-08-27\n\n- Старое.\n",
      "1.4.0",
    ),
  );
});

test("extractReleaseNotes rejects a duplicated section and a malformed version", () => {
  assert.throws(
    () => extractReleaseNotes(`${SAMPLE}\n## 1.4.0 - 2026-10-20\n\n- Ещё.\n`, "1.4.0"),
    /2 sections for 1\.4\.0/,
  );

  for (const version of ["", "1.4", "v1.4.0", "1.4.0-beta", "1.4.x"]) {
    assert.throws(() => extractReleaseNotes(SAMPLE, version), ReleaseNotesError, version);
  }
});

test("package.json, package-lock.json and manifest.json carry the same version", () => {
  const { version } = readJson("package.json");
  const lock = readJson("package-lock.json");

  assert.equal(readJson("manifest.json").version, version);
  assert.equal(lock.version, version);
  assert.equal(lock.packages?.[""]?.version, version);
});

test("CHANGELOG.md has a dated, non-empty section for the current version", () => {
  const { version } = readJson("package.json");
  const changelog = readChangelog();

  assert.ok(extractReleaseNotes(changelog, version));
  assert.match(
    changelog,
    new RegExp(
      `^## \\[?${version.replaceAll(".", "\\.")}\\]? - \\d{4}-\\d{2}-\\d{2}$`,
      "m",
    ),
  );
});

test("the current version is the newest section of CHANGELOG.md", () => {
  const { version } = readJson("package.json");
  const [newest] = [...readChangelog().matchAll(/^## \[?(\d+\.\d+\.\d+)\]?/gm)];

  assert.equal(newest?.[1], version);
});

test("the CLI prints the section and exits non-zero without one", () => {
  const { version } = readJson("package.json");
  const script = join(ROOT, "scripts/release-notes.ts");
  const run = (...args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", script, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

  assert.equal(run(version), `${extractReleaseNotes(readChangelog(), version)}\n`);
  assert.throws(() => run("0.0.1"), /no section for 0\.0\.1/);
  assert.throws(() => run(), /Usage/);
});
