import { SUPPORTED_LANGUAGES } from '@kiemi/shared';
import { Button } from '@renderer/components/ui/button';
import { useT } from '@renderer/i18n/use-t';
import { trpc } from '@renderer/lib/trpc';
import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';

// Placeholder home screen until the real layout (M3-01).
export function App() {
  const { t, language, setLanguage } = useT();
  const info = useQuery(trpc.app.info.queryOptions());

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6">
      <div className="flex size-16 items-center justify-center rounded-lg bg-primary text-3xl font-bold text-primary-foreground">
        K
      </div>
      <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
      <p className="text-muted-foreground">{t('app.slogan')}</p>
      <Button>
        <Play />
        {t('common.run')}
      </Button>
      <p data-testid="app-version" className="text-xs text-muted-foreground">
        {info.data ? t('app.version', { version: info.data.version }) : t('common.loading')}
      </p>
      <fieldset className="flex items-center gap-2 text-sm">
        <legend className="sr-only">{t('settings.language')}</legend>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <Button
            key={lng}
            size="sm"
            variant={lng === language ? 'secondary' : 'ghost'}
            aria-pressed={lng === language}
            onClick={() => void setLanguage(lng)}
          >
            {t(`settings.languages.${lng}`)}
          </Button>
        ))}
      </fieldset>
    </main>
  );
}
