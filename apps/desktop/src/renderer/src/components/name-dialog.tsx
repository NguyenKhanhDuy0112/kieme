import { Button } from '@renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { useTx } from '@renderer/lib/tx';
import { useEffect, useState } from 'react';

export interface NameDialogState {
  title: string;
  initial: string;
  /** Show a tags field (tests). */
  tags?: string[];
  onSubmit(name: string, tags: string[]): void | Promise<void>;
}

/** Small dialog to name (and tag) something. */
export function NameDialog({
  state,
  onClose,
}: {
  state: NameDialogState | null;
  onClose: () => void;
}) {
  const tx = useTx();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  useEffect(() => {
    if (state) {
      setName(state.initial);
      setTags((state.tags ?? []).join(', '));
    }
  }, [state]);
  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!state || !name.trim()) return;
            await state.onSubmit(
              name.trim(),
              tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            );
            onClose();
          }}
        >
          <DialogHeader>
            <DialogTitle>{state?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name-dialog-name">{tx('ui.tree.namePrompt')}</Label>
            <Input
              id="name-dialog-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>
          {state?.tags !== undefined && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name-dialog-tags">{tx('ui.tree.tags')}</Label>
              <Input
                id="name-dialog-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={tx('ui.examples.tags')}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tx('common.cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {tx('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
