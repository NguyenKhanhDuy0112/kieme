import { createI18n } from '@renderer/i18n';
import { applyStoredReduceMotion } from '@renderer/lib/motion';
import { reportUncaughtErrors } from '@renderer/lib/report-errors';
import { hideSplash } from '@renderer/lib/splash';
import { queryClient, trpcClient } from '@renderer/lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { App } from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

reportUncaughtErrors(window, (e) => trpcClient.app.reportError.mutate(e));
applyStoredReduceMotion();
const i18n = createI18n();
// Safety net: the splash never stays if the app fails to load its settings [U-18].
setTimeout(() => void hideSplash(), 10_000);

createRoot(rootEl).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
);
