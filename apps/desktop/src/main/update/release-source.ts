import type { UpdateMode } from './update-service';

/** GitHub repository with the releases. Must match `electron-builder.config.js` (ADR 0015). */
export const RELEASE_SOURCE = { owner: 'NguyenKhanhDuy0112', repo: 'kieme' } as const;

export const RELEASE_PAGE_URL = `https://github.com/${RELEASE_SOURCE.owner}/${RELEASE_SOURCE.repo}/releases/latest`;

/**
 * `auto` for an installed app, `notify` for the Windows portable exe (it cannot replace
 * itself), `off` in development or when `KIEMI_DISABLE_UPDATES=1` (automated UI checks).
 */
export function updateMode(isPackaged: boolean, env: NodeJS.ProcessEnv): UpdateMode {
  if (!isPackaged || env.KIEMI_DISABLE_UPDATES === '1') return 'off';
  return env.PORTABLE_EXECUTABLE_DIR ? 'notify' : 'auto';
}
