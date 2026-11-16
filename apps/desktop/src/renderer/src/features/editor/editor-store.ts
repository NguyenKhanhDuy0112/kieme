import type { TestCase } from '@kiemi/schema';
import { create } from 'zustand';

const MAX_HISTORY = 100;

interface EditorState {
  testId: string | null;
  doc: TestCase | null;
  /** DB version the doc is based on (optimistic lock). */
  version: number;
  past: TestCase[];
  future: TestCase[];
  selectedId: string | null;
  dirty: boolean;
  /** Loads a test fresh from the database (clears history). */
  load(testId: string, doc: TestCase, version: number): void;
  /** Applies an edit; it can be undone (J-06). */
  apply(change: (doc: TestCase) => TestCase): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  markSaved(version: number): void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  testId: null,
  doc: null,
  version: 0,
  past: [],
  future: [],
  selectedId: null,
  dirty: false,
  load: (testId, doc, version) =>
    set({ testId, doc, version, past: [], future: [], selectedId: null, dirty: false }),
  apply: (change) => {
    const { doc, past } = get();
    if (!doc) return;
    const next = change(doc);
    if (next === doc) return;
    set({ doc: next, past: [...past, doc].slice(-MAX_HISTORY), future: [], dirty: true });
  },
  undo: () => {
    const { doc, past, future } = get();
    const prev = past.at(-1);
    if (!doc || !prev) return;
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], dirty: true });
  },
  redo: () => {
    const { doc, past, future } = get();
    const [next, ...rest] = future;
    if (!doc || !next) return;
    set({ doc: next, past: [...past, doc], future: rest, dirty: true });
  },
  select: (selectedId) => set({ selectedId }),
  markSaved: (version) => set({ version, dirty: false }),
}));
