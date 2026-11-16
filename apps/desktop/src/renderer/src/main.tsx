import { createI18n } from '@renderer/i18n';
import { reportUncaughtErrors } from '@renderer/lib/report-errors';
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
const i18n = createI18n();

createRoot(rootEl).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
);
