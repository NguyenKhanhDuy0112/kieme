import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Empty screens always explain and offer the next action (U-06). */
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
      <div className="flex size-14 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}
