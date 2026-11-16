import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createServices,
  ensureDefaultWorkspace,
  openDatabase,
  type SecretCipher,
  type Services,
} from '@kiemi/db';
import { type SampleSite, startSampleSite } from '@kiemi/demo-site/sample';
import { BRAND } from '@kiemi/shared';
import { app, BrowserWindow, net, protocol, safeStorage, shell } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { autoUpdater } from 'electron-updater';
import { rootRouter } from './api/root';
import { isTrustedRendererUrl } from './ipc-allow';
import { RecorderManager } from './record/recorder-manager';
import { ARTIFACT_SCHEME, parseArtifactUrl, resolveInside } from './results/artifact-path';
import { TraceServer } from './results/trace-server';
import { RunManager } from './run/run-manager';
import { spawnUtilityWorker } from './run/spawn-utility';
import { SAMPLE_PORT, SAMPLE_PROJECT, syncSampleEnvironment } from './samples/samples';
import { openSshTunnel } from './tunnel/ssh-tunnel';
import { RELEASE_PAGE_URL, RELEASE_SOURCE, updateMode } from './update/release-source';
import { UpdateService } from './update/update-service';
import { createMainWindowOptions } from './window-options';

const rendererHtmlPath = join(__dirname, '../renderer/index.html');
const devServerUrl = app.isPackaged ? undefined : process.env.ELECTRON_RENDERER_URL;

/** Secrets are encrypted by the OS keychain (Keychain / DPAPI) [N-07]. */
const keychainCipher: SecretCipher = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (cipher) => safeStorage.decryptString(cipher),
};

/** Opens `userData/kiemi.db`, migrates and seeds the default workspace [M2-01]. */
function openData(): { services: Services; defaultProjectId: string } {
  const userData = app.getPath('userData');
  // A new app version may migrate the DB: keep a copy of the old one first [N-12].
  const db = openDatabase({
    path: join(userData, 'kiemi.db'),
    backupDir: join(userData, 'backups'),
  });
  const seed = ensureDefaultWorkspace(db);
  return {
    services: createServices({ db, workspaceId: seed.workspaceId }, keychainCipher),
    defaultProjectId: seed.projectId,
  };
}

/** Built demo site shipped with the app, target of the sample tests [L-01]. */
const sampleSiteDir = app.isPackaged
  ? join(process.resourcesPath, 'sample-site')
  : join(app.getAppPath(), '../demo-site/dist');
let sampleSite: Promise<SampleSite> | undefined;

/** Starts the sample site once and points the sample environment at it. */
function sampleSiteUrl(services: Services): Promise<string> {
  sampleSite ??= startSampleSite({ dir: sampleSiteDir, port: SAMPLE_PORT });
  return sampleSite.then((site) => {
    syncSampleEnvironment(services, site.url);
    return site.url;
  });
}

/** Updates from GitHub Releases: background download (installed) or notice (portable) [N-12]. */
function createUpdates(): UpdateService {
  const mode = updateMode(app.isPackaged, process.env);
  // The portable exe has no app-update.yml: point it at the releases explicitly.
  if (mode === 'notify') autoUpdater.setFeedURL({ provider: 'github', ...RELEASE_SOURCE });
  return new UpdateService({ updater: autoUpdater, mode, releasePageUrl: RELEASE_PAGE_URL });
}

let runs: RunManager | undefined;
let updates: UpdateService | undefined;
let recorder: RecorderManager | undefined;
const traceServer = new TraceServer();

/** Screenshots / videos of runs, read-only and limited to each run's folder [S-04]. */
function registerArtifactProtocol(services: Services): void {
  protocol.handle(ARTIFACT_SCHEME, async (request) => {
    const parsed = parseArtifactUrl(request.url);
    const run = parsed ? services.runs.repo.find(parsed.runId) : undefined;
    const file = parsed && run ? resolveInside(run.artifactDir ?? '', parsed.path) : undefined;
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href, { headers: request.headers });
  });
}

/** Playwright's trace viewer in its own window [I-03]. */
async function openTraceWindow(file: string): Promise<void> {
  const url = await traceServer.urlFor(file);
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Trace',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('https://')) void shell.openExternal(target);
    return { action: 'deny' };
  });
  await win.loadURL(url);
}

function registerIpc(): void {
  const data = openData();
  const userData = app.getPath('userData');
  // Engine runs in its own utility process so the window never freezes [N-05].
  const runManager = new RunManager({
    services: data.services,
    spawnWorker: () => spawnUtilityWorker(join(__dirname, 'engine-worker.js')),
    artifactsRoot: join(userData, 'runs'),
    browsersPath: join(userData, 'browsers'),
    openTunnel: (env, secrets) => {
      if (!env.ssh) throw new Error('No SSH settings');
      return openSshTunnel(env.ssh, secrets);
    },
  });
  runs = runManager;
  // Recording / Pick run in their own engine process too [M5].
  const recorderManager = new RecorderManager({
    services: data.services,
    spawnWorker: () => spawnUtilityWorker(join(__dirname, 'engine-worker.js')),
    browsersPath: join(userData, 'browsers'),
    openTunnel: (env, secrets) => {
      if (!env.ssh) throw new Error('No SSH settings');
      return openSshTunnel(env.ssh, secrets);
    },
  });
  recorder = recorderManager;
  registerArtifactProtocol(data.services);
  const updateService = createUpdates();
  updates = updateService;
  updateService.start();
  // The sample tests must work right away after a restart: start their site in the background.
  if (data.services.projects.list().some((p) => p.name === SAMPLE_PROJECT)) {
    setTimeout(() => void sampleSiteUrl(data.services).catch(() => undefined), 0);
  }
  const rendererFileUrl = pathToFileURL(rendererHtmlPath).href;
  createIPCHandler({
    router: rootRouter,
    // Our own preload exposes electron-trpc (it is bundled there for the sandbox).
    preload: false,
    allow: (event) =>
      isTrustedRendererUrl(event.senderFrame?.url, { rendererFileUrl, devServerUrl }),
    createContext: async () => ({
      appVersion: app.getVersion(),
      platform: process.platform,
      services: data.services,
      defaultProjectId: data.defaultProjectId,
      runs: runManager,
      recorder: recorderManager,
      sampleSiteUrl: () => sampleSiteUrl(data.services),
      updates: updateService,
      desktop: {
        openExternal: (url: string) => {
          if (url.startsWith('https://')) void shell.openExternal(url);
        },
        openTrace: openTraceWindow,
        showInFolder: (path: string) => shell.showItemInFolder(path),
      },
    }),
  });
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow(createMainWindowOptions(join(__dirname, '../preload/index.js')));

  win.once('ready-to-show', () => win.show());

  // Never open new Electron windows from renderer content; hand http(s) links to the OS browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Block in-app navigation away from the bundled UI.
  win.webContents.on('will-navigate', (event, url) => {
    if (devServerUrl && url.startsWith(devServerUrl)) return;
    event.preventDefault();
  });

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(rendererHtmlPath);
  }
  return win;
}

app.setAppUserModelId(BRAND.appId);

// Must be registered before `ready` so <img>/<video> can stream from it.
protocol.registerSchemesAsPrivileged([
  {
    scheme: ARTIFACT_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  void app.whenReady().then(() => {
    registerIpc();
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('before-quit', () => {
    updates?.stop();
    void runs?.shutdown();
    void recorder?.shutdown();
    void traceServer.close();
    void sampleSite?.then((site) => site.close());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
