import { isAbsolute, relative, resolve } from 'node:path';

export { ARTIFACT_SCHEME, artifactUrl, parseArtifactUrl } from './artifact-url';

/** Absolute file inside the run folder, or `undefined` if the path escapes it. */
export function resolveInside(dir: string, rel: string): string | undefined {
  if (!dir || isAbsolute(rel)) return undefined;
  const file = resolve(dir, rel);
  const r = relative(resolve(dir), file);
  if (!r || r.startsWith('..') || isAbsolute(r)) return undefined;
  return file;
}
