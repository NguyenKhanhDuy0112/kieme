import { AppSidebar } from '@renderer/components/app-sidebar';
import { CommandPalette } from '@renderer/components/command-palette';
import { Button } from '@renderer/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@renderer/components/ui/sidebar';
import { Toaster } from '@renderer/components/ui/sonner';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import { ElementsScreen } from '@renderer/features/elements/elements-screen';
import { EnvironmentsScreen } from '@renderer/features/environments/environments-screen';
import { HistoryScreen } from '@renderer/features/history/history-screen';
import { RunScreen } from '@renderer/features/run/run-screen';
import { SettingsScreen } from '@renderer/features/settings/settings-screen';
import { TestsScreen } from '@renderer/features/tests/tests-screen';
import { useT } from '@renderer/i18n/use-t';
import { useAppStore, watchSystemTheme } from '@renderer/lib/store';
import { trpc } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery } from '@tanstack/react-query';
import { PanelRight } from 'lucide-react';
import { useEffect } from 'react';

/** App shell (U-01): sidebar · main area · detail panel (inside screens). */
export function App() {
  const tx = useTx();
  const { language, setLanguage } = useT();
  const info = useQuery(trpc.app.info.queryOptions());
  const settings = useQuery(trpc.system.settings.queryOptions());
  const view = useAppStore((s) => s.view);
  const openRunId = useAppStore((s) => s.openRunId);
  const projectId = useAppStore((s) => s.projectId);
  const setProject = useAppStore((s) => s.setProject);
  const toggleDetail = useAppStore((s) => s.toggleDetail);

  useEffect(() => watchSystemTheme(), []);
  // First load: the default project, and the saved language/theme (S-07).
  useEffect(() => {
    if (!projectId && info.data?.defaultProjectId) setProject(info.data.defaultProjectId);
  }, [info.data, projectId, setProject]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: apply stored settings only when they change, not on every language switch.
  useEffect(() => {
    if (!settings.data) return;
    useAppStore.getState().setThemeChoice(settings.data.theme);
    if (settings.data.language !== language) void setLanguage(settings.data.language);
  }, [settings.data?.theme, settings.data?.language]);

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className="h-screen">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 flex-col">
          <div className="flex items-center gap-1 border-b px-2 py-1">
            <SidebarTrigger />
            <span className="text-sm font-medium">{tx(`ui.nav.${view}`)}</span>
            <span data-testid="app-version" className="ml-auto text-xs text-muted-foreground">
              {info.data ? tx('app.version', { version: info.data.version }) : tx('common.loading')}
            </span>
            {view === 'tests' && !openRunId && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={tx('ui.nav.toggleDetail')}
                onClick={toggleDetail}
              >
                <PanelRight />
              </Button>
            )}
          </div>
          {projectId && openRunId ? (
            <main className="flex min-h-0 flex-1 flex-col">
              <RunScreen key={openRunId} runId={openRunId} />
            </main>
          ) : projectId ? (
            <main className="flex min-h-0 flex-1 flex-col">
              {view === 'tests' && <TestsScreen />}
              {view === 'environments' && <EnvironmentsScreen />}
              {view === 'elements' && <ElementsScreen />}
              {view === 'settings' && <SettingsScreen />}
              {view === 'history' && <HistoryScreen />}
            </main>
          ) : null}
        </SidebarInset>
        <CommandPalette />
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
