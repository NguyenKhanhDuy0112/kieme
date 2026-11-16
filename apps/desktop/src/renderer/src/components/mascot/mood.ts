import type { MascotMood } from './mascot';

/** Cú Kiemi's face for a run status [U-16]. */
export function moodForStatus(status: string): MascotMood {
  switch (status) {
    case 'queued':
    case 'running':
      return 'focused';
    case 'passed':
      return 'happy';
    case 'failed':
    case 'error':
      return 'worried';
    default:
      return 'idle';
  }
}
