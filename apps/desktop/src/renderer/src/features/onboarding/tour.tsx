import { Button } from '@renderer/components/ui/button';
import { trpc } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSaveSettings } from './onboarding';
import { CARD_W, placeCard } from './pure';

/** Tour stops: `data-tour` attribute of the element each one points at (U-14). */
export const TOUR_STOPS = ['steps', 'record', 'run'] as const;
type Stop = (typeof TOUR_STOPS)[number];

/**
 * 3-step tour of the editor the first time a test is opened (L-02, U-14):
 * steps table → Ghi lại → Chạy. Escape or "Bỏ qua" ends it for good.
 */
export function EditorTour() {
  const tx = useTx();
  const settings = useQuery(trpc.system.settings.queryOptions());
  const saveSettings = useSaveSettings();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const [cardH, setCardH] = useState(160);

  const active = settings.data?.onboardingDone === true && settings.data.tourDone === false;
  const stop: Stop | undefined = TOUR_STOPS[index];

  // Follow the target while it moves (layout changes, window resize).
  useEffect(() => {
    if (!active || !stop) return;
    let frame = 0;
    const measure = () => {
      const el = document.querySelector(`[data-tour="${stop}"]`);
      const r = el?.getBoundingClientRect() ?? null;
      setRect((old) =>
        old && r && old.top === r.top && old.left === r.left && old.width === r.width ? old : r,
      );
      frame = window.setTimeout(measure, 250);
    };
    measure();
    return () => clearTimeout(frame);
  }, [active, stop]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  });
  useEffect(() => {
    if (rect) nextBtn.current?.focus();
  }, [rect]);

  const end = () => void saveSettings({ tourDone: true });
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!active || !stop || !rect) return null;
  const pos = placeCard(rect, { width: window.innerWidth, height: window.innerHeight }, cardH);
  const last = index === TOUR_STOPS.length - 1;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-50 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
      <div
        ref={card}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        data-testid="editor-tour"
        className="fixed z-50 flex flex-col gap-2 rounded-xl border bg-popover p-4 text-popover-foreground shadow-md"
        style={{ top: pos.top, left: pos.left, width: CARD_W }}
      >
        <span className="text-xs text-muted-foreground">
          {tx('ui.onboarding.tourStep', { no: index + 1, total: TOUR_STOPS.length })}
        </span>
        <h2 id="tour-title" className="font-semibold">
          {tx(`ui.onboarding.tour.${stop}.title`)}
        </h2>
        <p id="tour-text" className="text-sm text-muted-foreground">
          {tx(`ui.onboarding.tour.${stop}.text`)}
        </p>
        <div className="mt-1 flex justify-end gap-2">
          {!last && (
            <Button variant="ghost" size="sm" onClick={end}>
              {tx('ui.onboarding.skipTour')}
            </Button>
          )}
          <Button ref={nextBtn} size="sm" onClick={() => (last ? end() : setIndex(index + 1))}>
            {last ? tx('ui.onboarding.done') : tx('ui.onboarding.next')}
          </Button>
        </div>
      </div>
    </>
  );
}
