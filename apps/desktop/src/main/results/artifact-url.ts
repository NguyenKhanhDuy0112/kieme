// No Node imports: used by the renderer too.
/** Custom scheme the renderer uses to show run screenshots and videos [S-04]. */
export const ARTIFACT_SCHEME = 'kiemi-artifact';

/** `kiemi-artifact://run/<runId>/<relative path>` */
export function artifactUrl(runId: string, path: string): string {
  return `${ARTIFACT_SCHEME}://run/${encodeURIComponent(runId)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

/** Parses an artifact URL; `undefined` when it is not one. */
export function parseArtifactUrl(url: string): { runId: string; path: string } | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  if (u.protocol !== `${ARTIFACT_SCHEME}:` || u.hostname !== 'run') return undefined;
  const [runId, ...rest] = u.pathname.replace(/^\//, '').split('/').map(decodeURIComponent);
  if (!runId || rest.length === 0) return undefined;
  return { runId, path: rest.join('/') };
}
