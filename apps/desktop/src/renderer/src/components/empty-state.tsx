import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Mascot } from './mascot/mascot';

/** Empty screens always explain and offer the next action, with Cú Kiemi (U-06, U-16). */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="relative">
        <Mascot size={104} />
        <div className="absolute -right-1 bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-background bg-secondary text-secondary-foreground">
          <Icon className="size-4" aria-hidden />
        </div>
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
