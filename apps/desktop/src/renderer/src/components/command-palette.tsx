import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@renderer/components/ui/command';
import { useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, FileText, FolderPlus, Globe, Moon, Settings } from 'lucide-react';
import { useEffect } from 'react';

/** Ctrl/⌘ K: find a test, create one, jump to a screen (U-10). */
export function CommandPalette() {
  const tx = useTx();
  const qc = useQueryClient();
  const open = useAppStore((s) => s.paletteOpen);
  const setOpen = useAppStore((s) => s.setPaletteOpen);
  const projectId = useAppStore((s) => s.projectId) ?? '';
  const openTest = useAppStore((s) => s.openTest);
  const setView = useAppStore((s) => s.setView);
  const theme = useAppStore((s) => s.theme);
  const setThemeChoice = useAppStore((s) => s.setThemeChoice);
  const tests = useQuery({
    ...trpc.testCases.list.queryOptions({ projectId }),
    enabled: open && !!projectId,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useAppStore.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const go = (fn: () => void | Promise<void>) => {
    setOpen(false);
    void fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={tx('ui.palette.hint')}
      description={tx('ui.palette.placeholder')}
    >
      <CommandInput placeholder={tx('ui.palette.placeholder')} />
      <CommandList>
        <CommandEmpty>{tx('ui.palette.empty')}</CommandEmpty>
        <CommandGroup heading={tx('ui.palette.commands')}>
          <CommandItem
            onSelect={() =>
              go(async () => {
                const t = await trpcClient.testCases.create.mutate({
                  projectId,
                  name: tx('ui.tree.defaultTestName'),
                });
                await qc.invalidateQueries({ queryKey: trpc.testCases.list.queryKey() });
                openTest(t.id);
              })
            }
          >
            <FilePlus2 /> {tx('ui.palette.newTest')}
          </CommandItem>
          <CommandItem
            onSelect={() =>
              go(async () => {
                await trpcClient.folders.create.mutate({
                  projectId,
                  name: tx('ui.tree.defaultFolderName'),
                });
                await qc.invalidateQueries({ queryKey: trpc.folders.list.queryKey({ projectId }) });
                setView('tests');
              })
            }
          >
            <FolderPlus /> {tx('ui.palette.newFolder')}
          </CommandItem>
          <CommandItem onSelect={() => go(() => setView('environments'))}>
            <Globe /> {tx('ui.palette.goEnvironments')}
          </CommandItem>
          <CommandItem onSelect={() => go(() => setView('settings'))}>
            <Settings /> {tx('ui.palette.goSettings')}
          </CommandItem>
          <CommandItem
            onSelect={() => go(() => setThemeChoice(theme === 'dark' ? 'light' : 'dark'))}
          >
            <Moon /> {tx('ui.palette.toggleTheme')}
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={tx('ui.palette.tests')}>
          {(tests.data ?? []).map((t) => (
            <CommandItem
              key={t.id}
              value={`${t.name} ${t.tags.join(' ')} ${t.id}`}
              onSelect={() => go(() => openTest(t.id))}
            >
              <FileText /> {t.name}
              <CommandShortcut>{tx('ui.tree.steps', { count: t.stepCount })}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
