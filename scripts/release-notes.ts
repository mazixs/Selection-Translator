import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Prints the CHANGELOG.md section of one version: the text of the GitHub
 * Release. CD runs it for the tag being released and fails when there is no
 * section or it is empty, so a release never goes out without notes.
 *
 *   npm run --silent release-notes -- 1.4.0
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERSION = /^\d+\.\d+\.\d+$/;
// "## 1.4.0 - 2026-10-19", with the version optionally in brackets.
const SECTION_HEADING = /^## \[?(\d+\.\d+\.\d+)\]?(?:\s+-\s+\d{4}-\d{2}-\d{2})?\s*$/;
const ANY_SECTION_HEADING = /^## /;
const SUBSECTION_HEADING = /^#{3,6}\s/;

export class ReleaseNotesError extends Error {}

/** Body of the `version` section, without its heading, trimmed. */
export function extractReleaseNotes(changelog: string, version: string): string {
  if (!VERSION.test(version)) {
    throw new ReleaseNotesError(`"${version}" is not a version like 1.4.0`);
  }

  const lines = changelog.split(/\r?\n/);
  const starts: number[] = [];

  for (const [index, line] of lines.entries()) {
    if (SECTION_HEADING.exec(line)?.[1] === version) {
      starts.push(index);
    }
  }

  const [start] = starts;

  if (start === undefined) {
    throw new ReleaseNotesError(`CHANGELOG.md has no section for ${version}`);
  }

  if (starts.length > 1) {
    throw new ReleaseNotesError(
      `CHANGELOG.md has ${starts.length} sections for ${version}`,
    );
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => ANY_SECTION_HEADING.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  const hasContent = body
    .split("\n")
    .some((line) => line.trim() !== "" && !SUBSECTION_HEADING.test(line));

  if (!hasContent) {
    throw new ReleaseNotesError(`The CHANGELOG.md section for ${version} is empty`);
  }

  return body;
}

function main(argv: string[]): number {
  const [version, extra] = argv;

  if (!version || extra !== undefined) {
    console.error("Usage: release-notes <version>, for example: release-notes 1.4.0");
    return 2;
  }

  try {
    const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    process.stdout.write(`${extractReleaseNotes(changelog, version)}\n`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
