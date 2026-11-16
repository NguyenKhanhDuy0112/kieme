import { Button } from '@renderer/components/ui/button';
import { Play } from 'lucide-react';

// Placeholder screen for M0-02. Strings move to i18n in M0-04.
export function App() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6">
      <div className="flex size-16 items-center justify-center rounded-lg bg-primary text-3xl font-bold text-primary-foreground">
        K
      </div>
      <h1 className="text-2xl font-semibold">Hello Kiemi</h1>
      <p className="text-muted-foreground">Bấm một lần, kiểm mãi mãi.</p>
      <Button>
        <Play />
        Chạy
      </Button>
    </main>
  );
}
