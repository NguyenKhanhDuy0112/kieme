import type { TestCase } from '@kiemi/schema';
import { Button } from '@renderer/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { useAppStore } from '@renderer/lib/store';
import { useTx } from '@renderer/lib/tx';
import { ChevronDown, Footprints, Loader2, Play, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { RunDialog, useStartRun } from './run-dialog';
import { isFinished } from './run-state';
import { useRunStore } from './run-store';

/** Main action of the editor (U-02): Run, with options in a menu [M4-02, M4-03]. */
export function EditorRunButton({
  testId,
  testCase,
  beforeRun,
  dialogStartAt,
  onDialogClose,
}: {
  testId: string;
  testCase: TestCase;
  beforeRun: () => Promise<void>;
  /** Opens the options dialog preset to "run from this step". */
  dialogStartAt?: string | undefined;
  onDialogClose?: () => void;
}) {
  const tx = useTx();
  const startRun = useStartRun();
  const openRun = useAppStore((s) => s.openRun);
  const [dialog, setDialog] = useState(false);
  const activeRunId = useRunStore((s) => {
    const id = s.latestByTest[testId];
    const r = id ? s.runs[id] : undefined;
    return r && !isFinished(r.status) ? id : undefined;
  });
  const target = { kind: 'test' as const, testCaseId: testId };
  const open = dialog || dialogStartAt !== undefined;

  if (activeRunId) {
    return (
      <Button size="sm" variant="outline" onClick={() => openRun(activeRunId)}>
        <Loader2 className="animate-spin" /> {tx('ui.run.status.running')}
      </Button>
    );
  }

  return (
    <div className="flex items-center">
      <Button
        size="sm"
        className="rounded-r-none"
        onClick={async () => {
          await beforeRun();
          await startRun(target);
        }}
      >
        <Play /> {tx('common.run')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="rounded-l-none border-l border-primary-foreground/20 px-2"
            aria-label={tx('ui.run.options')}
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={async () => {
              await beforeRun();
              setDialog(true);
            }}
          >
            <SlidersHorizontal /> {tx('ui.run.options')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              await beforeRun();
              await startRun(target, { pauseAtStart: true });
            }}
          >
            <Footprints /> {tx('ui.run.stepByStep')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RunDialog
        open={open}
        onOpenChange={(o) => {
          setDialog(o);
          if (!o) onDialogClose?.();
        }}
        target={target}
        testCase={testCase}
        initialStartAt={dialogStartAt}
      />
    </div>
  );
}
