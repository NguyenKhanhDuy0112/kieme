import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { EngineError } from '../errors';

export interface DownloadProgress {
  /** 0–100. */
  percent: number;
  /** Size of the archive being downloaded, if known. */
  totalMiB?: number;
}

/**
 * Path of Playwright's Chromium inside `browsersPath`. Playwright reads its own
 * browsers dir once at startup, so we re-root its default path instead.
 */
export function chromiumExecutablePath(browsersPath: string): string {
  const exe = chromium.executablePath();
  const match = exe.match(/[\\/](chromium-\d+)[\\/](.+)$/);
  if (!match?.[1] || !match[2]) return exe;
  return join(browsersPath, match[1], match[2]);
}

export function isChromiumInstalled(browsersPath: string): boolean {
  return existsSync(chromiumExecutablePath(browsersPath));
}

/** Parses Playwright's non-TTY progress lines: `|■■■■      |  40% of 150.2 MiB`. */
export function parseProgressLine(line: string): DownloadProgress | undefined {
  const m = line.match(/(\d{1,3})% of ([\d.]+) MiB/);
  if (!m?.[1]) return undefined;
  const percent = Math.min(100, Number(m[1]));
  return m[2] ? { percent, totalMiB: Number(m[2]) } : { percent };
}

export interface InstallChromiumOptions {
  /** Where browsers are stored (app data dir), e.g. `<userData>/browsers`. */
  browsersPath: string;
  onProgress?: (p: DownloadProgress) => void;
  signal?: AbortSignal;
  /** Test seam: runs the installer and streams its output lines. */
  run?: (
    args: string[],
    env: NodeJS.ProcessEnv,
    onLine: (line: string) => void,
    signal?: AbortSignal,
  ) => Promise<number>;
}

/** Downloads Chromium (no headless shell) when no Edge/Chrome is installed [N-03]. */
export async function installChromium(options: InstallChromiumOptions): Promise<string> {
  const run = options.run ?? runPlaywrightCli;
  const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: options.browsersPath };
  let lastPercent = -1;
  const output: string[] = [];
  const code = await run(
    ['install', '--no-shell', 'chromium'],
    env,
    (line) => {
      output.push(line);
      const p = parseProgressLine(line);
      // Each archive (chromium, ffmpeg) restarts at 0%; report monotonic progress per archive.
      if (p && p.percent !== lastPercent) {
        lastPercent = p.percent;
        options.onProgress?.(p);
      }
    },
    options.signal,
  );
  if (code !== 0) {
    throw new EngineError('BROWSER_DOWNLOAD_FAILED', 'Could not download Chromium', {
      exitCode: code,
      output: output.slice(-5).join('\n'),
    });
  }
  return chromiumExecutablePath(options.browsersPath);
}

/** Runs `playwright-core/cli.js` with the current Node (or Electron as Node). */
function runPlaywrightCli(
  args: string[],
  env: NodeJS.ProcessEnv,
  onLine: (line: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const require = createRequire(import.meta.url);
  const cli = join(dirname(require.resolve('playwright-core/package.json')), 'cli.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(signal ? { signal } : {}),
    });
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const l of lines) onLine(l);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => {
      if (buffer) onLine(buffer);
      resolve(code ?? 1);
    });
  });
}

let ffmpegReady: Promise<void> | undefined;

/**
 * Makes sure Playwright's ffmpeg (needed to record videos, ~1 MB) is installed
 * in the browsers folder Playwright uses for this process [I-03]. Runs once per
 * process; a failed attempt is retried next time.
 */
export function ensureFfmpeg(run: InstallChromiumOptions['run'] = runPlaywrightCli): Promise<void> {
  ffmpegReady ??= (async () => {
    const output: string[] = [];
    const code = await run(['install', 'ffmpeg'], { ...process.env }, (l) => output.push(l));
    if (code !== 0) {
      throw new EngineError('BROWSER_DOWNLOAD_FAILED', 'Could not download ffmpeg for videos', {
        exitCode: code,
        output: output.slice(-5).join('\n'),
      });
    }
  })().catch((err: unknown) => {
    ffmpegReady = undefined;
    throw err;
  });
  return ffmpegReady;
}
