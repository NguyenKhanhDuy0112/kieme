import type { UpdateState } from '@main/update/update-service';

type Tx = (key: string, vars?: Record<string, unknown>) => string;

/** One line describing the update state, in the user's language. */
export function updateStatusText(s: UpdateState, tx: Tx): string {
  switch (s.status) {
    case 'downloading':
      return tx('ui.update.status.downloading', { version: s.version, percent: s.percent });
    case 'ready':
    case 'available':
      return tx(`ui.update.status.${s.status}`, { version: s.version });
    default:
      return tx(`ui.update.status.${s.status}`);
  }
}
