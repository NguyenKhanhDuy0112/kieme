import { cn } from '@renderer/lib/utils';

/** How Cú Kiemi feels [U-16]: idle, a run passed, a run failed, a run is going on. */
export type MascotMood = 'idle' | 'happy' | 'worried' | 'focused';

interface MascotProps {
  mood?: MascotMood;
  /** Pixel size of the square drawing. */
  size?: number;
  className?: string;
}

const INK = '#141b3d';
const AMBER = '#f5b83d';
const TICK = '#3ddc84';

function Eyes({ mood }: { mood: MascotMood }) {
  const white = (r = 26, y = 86) => (
    <>
      <circle cx="72" cy={y} r={r} fill="#fff" />
      <circle cx="128" cy={y} r={r} fill="#fff" />
    </>
  );
  const pupils = (dx: number, dy: number, r = 12) => (
    <g className="mascot-pupils">
      <circle cx={72 + dx} cy={86 + dy} r={r} fill={INK} />
      <circle cx={128 + dx} cy={86 + dy} r={r} fill={INK} />
      <circle cx={76 + dx} cy={81 + dy} r={r * 0.36} fill="#fff" />
      <circle cx={132 + dx} cy={81 + dy} r={r * 0.36} fill="#fff" />
    </g>
  );
  switch (mood) {
    case 'happy':
      return (
        <>
          {white()}
          <path
            d="M59 92 Q72 76 85 92 M115 92 Q128 76 141 92"
            stroke={INK}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="50" cy="114" r="9" fill="#ff8fab" opacity=".55" />
          <circle cx="150" cy="114" r="9" fill="#ff8fab" opacity=".55" />
        </>
      );
    case 'worried':
      return (
        <>
          {white(24, 88)}
          {pupils(0, 9, 10)}
          <path
            d="M50 60 L86 52 M150 60 L114 52"
            stroke="var(--mascot-belly)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path d="M168 58 q7 11 0 16 q-7 -5 0 -16z" fill="#8cc8ff" />
        </>
      );
    case 'focused':
      return (
        <>
          {white()}
          {pupils(7, -7, 11)}
          <path
            d="M114 50 Q130 40 146 50"
            stroke="var(--mascot-belly)"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    default:
      return (
        <>
          {white()}
          <g className="mascot-blink">{pupils(3, 4)}</g>
        </>
      );
  }
}

/**
 * Cú Kiemi, the app mascot [U-16]: a round indigo owl with big eyes and a green tick
 * on its belly. Decorative only (`aria-hidden`): always pair it with text.
 */
export function Mascot({ mood = 'idle', size = 96, className }: MascotProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
      className={cn('mascot shrink-0', `mascot-${mood}`, className)}
    >
      <g className="mascot-body">
        <ellipse cx="82" cy="186" rx="11" ry="6" fill={AMBER} />
        <ellipse cx="118" cy="186" rx="11" ry="6" fill={AMBER} />
        <path d="M46 64 L36 22 L82 46 Z M154 64 L164 22 L118 46 Z" fill="var(--mascot-body)" />
        <ellipse cx="100" cy="112" rx="70" ry="74" fill="var(--mascot-body)" />
        <ellipse
          className="mascot-wing-l"
          cx="36"
          cy="128"
          rx="15"
          ry="30"
          fill="var(--mascot-wing)"
          transform="rotate(14 36 128)"
        />
        <ellipse
          className="mascot-wing-r"
          cx="164"
          cy="128"
          rx="15"
          ry="30"
          fill="var(--mascot-wing)"
          transform="rotate(-14 164 128)"
        />
        <ellipse cx="100" cy="150" rx="42" ry="32" fill="var(--mascot-belly)" />
        <path
          className="mascot-tick"
          d="M80 150 L95 164 L121 136"
          stroke={TICK}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Eyes mood={mood} />
        <path d="M100 104 L91 114 Q100 121 109 114 Z" fill={AMBER} />
      </g>
    </svg>
  );
}
