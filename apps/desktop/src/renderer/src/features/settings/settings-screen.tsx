import { SUPPORTED_LANGUAGES } from '@kiemi/shared';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { useT } from '@renderer/i18n/use-t';
import { errorMessage } from '@renderer/lib/errors';
import { type ThemeChoice, useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type SettingsPatch = Parameters<typeof trpcClient.system.updateSettings.mutate>[0];

/** Settings (S-07): language, theme, default browser, timeout, results folder. */
export function SettingsScreen() {
  const tx = useTx();
  const { setLanguage } = useT();
  const qc = useQueryClient();
  const settings = useQuery(trpc.system.settings.queryOptions());
  const browsers = useQuery(trpc.system.browsers.queryOptions());
  const setThemeChoice = useAppStore((s) => s.setThemeChoice);

  const save = async (patch: SettingsPatch) => {
    try {
      const next = await trpcClient.system.updateSettings.mutate(patch);
      qc.setQueryData(trpc.system.settings.queryKey(), next);
      if (patch.language) await setLanguage(patch.language);
      if (patch.theme) setThemeChoice(patch.theme);
      toast.success(tx('ui.settingsScreen.saved'));
    } catch (err) {
      toast.error(errorMessage(err, tx));
    }
  };

  const s = settings.data;
  if (!s) return null;
  const installed = new Set(browsers.data ?? []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 overflow-auto p-6">
      <h1 className="text-lg font-semibold">{tx('ui.nav.settings')}</h1>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">{tx('ui.settingsScreen.appearance')}</h2>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="set-lang">{tx('settings.language')}</Label>
          <Select
            value={s.language}
            onValueChange={(language) => void save({ language: language as 'vi' | 'en' })}
          >
            <SelectTrigger id="set-lang" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {tx(`settings.languages.${l}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="set-theme">{tx('ui.settingsScreen.themeLabel')}</Label>
          <Select
            value={s.theme}
            onValueChange={(theme) => void save({ theme: theme as ThemeChoice })}
          >
            <SelectTrigger id="set-theme" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['light', 'dark', 'system'] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {tx(`ui.settingsScreen.theme.${t}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="set-browser">{tx('ui.settingsScreen.browser')}</Label>
          <Select
            value={s.browser}
            onValueChange={(browser) => void save({ browser: browser as SettingsPatch['browser'] })}
          >
            <SelectTrigger id="set-browser" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{tx('ui.settingsScreen.browserAuto')}</SelectItem>
              {(['msedge', 'chrome'] as const).map((b) => (
                <SelectItem key={b} value={b} disabled={!installed.has(b)}>
                  {b === 'msedge' ? 'Microsoft Edge' : 'Google Chrome'}
                  {!installed.has(b) && ` (${tx('ui.settingsScreen.notInstalled')})`}
                </SelectItem>
              ))}
              <SelectItem value="chromium">Chromium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="set-headless">{tx('ui.settingsScreen.headless')}</Label>
          <Switch
            id="set-headless"
            checked={s.headless}
            onCheckedChange={(headless) => void save({ headless })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="set-timeout">{tx('ui.settingsScreen.timeout')}</Label>
          <Input
            id="set-timeout"
            type="number"
            min={1}
            max={600}
            className="w-28"
            defaultValue={s.defaultTimeoutSec}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v !== s.defaultTimeoutSec && v >= 1 && v <= 600)
                void save({ defaultTimeoutSec: Math.round(v) });
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="set-dir">{tx('ui.settingsScreen.resultsDir')}</Label>
          <Input
            id="set-dir"
            placeholder={tx('ui.settingsScreen.resultsDirHint')}
            defaultValue={s.resultsDir}
            onBlur={(e) =>
              e.target.value !== s.resultsDir && void save({ resultsDir: e.target.value.trim() })
            }
          />
        </div>
      </section>
    </div>
  );
}
