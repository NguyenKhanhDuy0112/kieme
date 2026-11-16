import { create } from 'zustand';

export type View = 'tests' | 'history' | 'environments' | 'elements' | 'settings';
export type ThemeChoice = 'light' | 'dark' | 'system';

interface AppState {
  view: View;
  projectId: string | null;
  /** Test open in the editor (inside the Tests view). */
  openTestId: string | null;
  /** Right detail panel (U-01). */
  detailOpen: boolean;
  paletteOpen: boolean;
  themeChoice: ThemeChoice;
  /** Resolved theme actually shown. */
  theme: 'light' | 'dark';
  setView(view: View): void;
  setProject(id: string): void;
  openTest(id: string | null): void;
  toggleDetail(): void;
  setPaletteOpen(open: boolean): void;
  setThemeChoice(choice: ThemeChoice): void;
}

const prefersDark = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
const resolve = (c: ThemeChoice): 'light' | 'dark' =>
  c === 'system' ? (prefersDark() ? 'dark' : 'light') : c;

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'tests',
  projectId: null,
  openTestId: null,
  detailOpen: true,
  paletteOpen: false,
  themeChoice: 'system',
  theme: resolve('system'),
  setView: (view) => set({ view }),
  setProject: (projectId) => set({ projectId, openTestId: null }),
  openTest: (openTestId) => set({ openTestId, view: 'tests' }),
  toggleDetail: () => set({ detailOpen: !get().detailOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setThemeChoice: (themeChoice) => {
    const theme = resolve(themeChoice);
    applyTheme(theme);
    set({ themeChoice, theme });
  },
}));

/** Follows the OS theme while the choice is "system" (U-11). */
export function watchSystemTheme(): () => void {
  const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return () => undefined;
  const onChange = () => {
    const s = useAppStore.getState();
    if (s.themeChoice === 'system') s.setThemeChoice('system');
  };
  mq.addEventListener('change', onChange);
  applyTheme(useAppStore.getState().theme);
  return () => mq.removeEventListener('change', onChange);
}
