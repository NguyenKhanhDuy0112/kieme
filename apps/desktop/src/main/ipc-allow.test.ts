import { describe, expect, it } from 'vitest';
import { isTrustedRendererUrl } from './ipc-allow';

const rendererFileUrl = 'file:///app/out/renderer/index.html';

describe('isTrustedRendererUrl', () => {
  it('trusts the bundled renderer, ignoring hash and query', () => {
    expect(isTrustedRendererUrl(rendererFileUrl, { rendererFileUrl })).toBe(true);
    expect(isTrustedRendererUrl(`${rendererFileUrl}#/tests`, { rendererFileUrl })).toBe(true);
  });

  it('trusts the dev server origin only when configured', () => {
    const devServerUrl = 'http://localhost:5173';
    expect(isTrustedRendererUrl('http://localhost:5173/x', { rendererFileUrl, devServerUrl })).toBe(
      true,
    );
    expect(isTrustedRendererUrl('http://localhost:5173/x', { rendererFileUrl })).toBe(false);
  });

  it('rejects other pages and missing urls', () => {
    expect(isTrustedRendererUrl('https://evil.example', { rendererFileUrl })).toBe(false);
    expect(isTrustedRendererUrl('file:///other/index.html', { rendererFileUrl })).toBe(false);
    expect(isTrustedRendererUrl(undefined, { rendererFileUrl })).toBe(false);
  });
});
