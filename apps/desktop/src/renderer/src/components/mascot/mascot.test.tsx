// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Mascot, type MascotMood } from './mascot';

afterEach(cleanup);

describe('Mascot [U-16]', () => {
  it('draws Cú Kiemi in every mood, hidden from screen readers', () => {
    for (const mood of ['idle', 'happy', 'worried', 'focused'] as MascotMood[]) {
      const { container } = render(<Mascot mood={mood} size={48} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('data-mood')).toBe(mood);
      expect(svg?.getAttribute('width')).toBe('48');
      // The green tick on the belly is the brand mark.
      expect(container.querySelector('.mascot-tick')).not.toBeNull();
      cleanup();
    }
  });

  it('follows the light / dark theme through CSS variables', () => {
    const { container } = render(<Mascot />);
    expect(container.innerHTML).toContain('var(--mascot-body)');
    expect(container.innerHTML).toContain('var(--mascot-belly)');
  });
});

describe('moodForStatus [U-16]', () => {
  it('is happy on pass, worried on failure, focused while running', async () => {
    const { moodForStatus } = await import('./mood');
    expect(moodForStatus('passed')).toBe('happy');
    expect(moodForStatus('failed')).toBe('worried');
    expect(moodForStatus('error')).toBe('worried');
    expect(moodForStatus('running')).toBe('focused');
    expect(moodForStatus('queued')).toBe('focused');
    expect(moodForStatus('cancelled')).toBe('idle');
  });
});
