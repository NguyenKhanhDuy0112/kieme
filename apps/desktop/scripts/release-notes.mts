/**
 * Release notes for a tag, taken from the Changesets CHANGELOG [N-11].
 *   node apps/desktop/scripts/release-notes.mts v1.2.0 release-notes.md
 * Fails when the tag does not match apps/desktop/package.json's version.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The "## <version>" section of a Changesets CHANGELOG, without its heading. */
export function notesFor(changelog: string, version: string): string {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${version}`);
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim();
}

/** `v1.2.0` → `1.2.0`; undefined when the tag is not a release tag. */
export function versionFromTag(tag: string): string | undefined {
  return /^v(\d+\.\d+\.\d+(?:-[\w.]+)?)$/.exec(tag.trim())?.[1];
}

function main(tag: string | undefined, out: string | undefined): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  const version = versionFromTag(tag ?? '');
  if (!version || version !== pkg.version) {
    console.error(`Tag "${tag}" does not match @kiemi/desktop version ${pkg.version}.`);
    process.exit(1);
  }
  let changelog = '';
  try {
    changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
  } catch {
    // First release without changesets.
  }
  const notes = notesFor(changelog, version) || 'Phát hành Kiemi.';
  if (out) writeFileSync(out, `${notes}\n`);
  else console.log(notes);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv[2], process.argv[3]);
}
