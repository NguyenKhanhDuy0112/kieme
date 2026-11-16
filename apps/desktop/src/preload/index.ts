// Preload runs sandboxed with contextIsolation. The ONLY bridge exposed to the renderer
// is electron-trpc (ARCHITECTURE.md). Do not expose arbitrary APIs here.
import { exposeElectronTRPC } from 'electron-trpc/preload';

exposeElectronTRPC();
