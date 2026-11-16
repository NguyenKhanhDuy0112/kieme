import type { UpdateMode } from './update-service';

/** GitHub repository with the releases. Must match `electron-builder.config.js` (ADR 0015). */
export const RELEASE_SOURCE = { owner: 'NguyenKhanhDuy0112', repo: 'kiemi' } as const;

export const RELEASE_PAGE_URL = `https://github.com/${RELEASE_SOURCE.owner}/${RELEASE_SOURCE.repo}/releases/latest`;

export interface BuildInfo {
  platform: NodeJS.Platform;
  /** The build was code-signed (`MAIN_VITE_CODE_SIGNED=1` set by the release workflow). */
  signed: boolean;
}

/**
 * `auto` for an installed app, `notify` for the Windows portable exe (it cannot replace
 * itself) and for an unsigned macOS app (Squirrel.Mac only installs signed updates) [N-12],
 * `off` in development or when `KIEMI_DISABLE_UPDATES=1` (automated UI checks).
 */
export function updateMode(
  isPackaged: boolean,
  env: NodeJS.ProcessEnv,
  build: BuildInfo,
): UpdateMode {
  if (!isPackaged || env.KIEMI_DISABLE_UPDATES === '1') return 'off';
  if (env.PORTABLE_EXECUTABLE_DIR) return 'notify';
  if (build.platform === 'darwin' && !build.signed) return 'notify';
  return 'auto';
}
