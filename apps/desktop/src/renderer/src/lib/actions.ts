import type { AppRouter } from '@main/api/root';
import { trpc } from '@renderer/lib/trpc';
import { useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';

export type ActionInfo = inferRouterOutputs<AppRouter>['system']['actions'][number];

/** Order of groups in the "Thêm bước" menu. */
export const GROUP_ORDER = ['navigation', 'input', 'tabs', 'flow', 'data', 'assert'] as const;

/** The action catalog from main (never changes while the app runs). */
export function useActions() {
  return useQuery({ ...trpc.system.actions.queryOptions(), staleTime: Number.POSITIVE_INFINITY });
}

export function byType(actions: readonly ActionInfo[] | undefined): Map<string, ActionInfo> {
  return new Map((actions ?? []).map((a) => [a.type, a]));
}

export function groupActions(
  actions: readonly ActionInfo[],
): { group: string; actions: ActionInfo[] }[] {
  const groups = new Map<string, ActionInfo[]>();
  for (const a of actions) groups.set(a.group, [...(groups.get(a.group) ?? []), a]);
  const order = (g: string) => {
    const i = (GROUP_ORDER as readonly string[]).indexOf(g);
    return i < 0 ? 99 : i;
  };
  return [...groups.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([group, list]) => ({ group, actions: list }));
}
