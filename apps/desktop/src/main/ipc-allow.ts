/**
 * Decides whether an IPC request comes from Kiemi's own UI.
 * Only the bundled renderer (file://…/renderer/index.html) or the dev server URL may call tRPC.
 */
export function isTrustedRendererUrl(
  url: string | undefined,
  opts: { rendererFileUrl: string; devServerUrl?: string | undefined },
): boolean {
  if (!url) return false;
  if (opts.devServerUrl) {
    try {
      if (new URL(url).origin === new URL(opts.devServerUrl).origin) return true;
    } catch {
      return false;
    }
  }
  return url.split('#')[0]?.split('?')[0] === opts.rendererFileUrl;
}
