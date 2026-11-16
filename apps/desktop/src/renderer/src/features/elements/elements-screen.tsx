import type { TestCase } from '@kiemi/schema';
import { EmptyState } from '@renderer/components/empty-state';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { elementUsages } from '@renderer/features/editor/doc-model';
import { errorMessage } from '@renderer/lib/errors';
import { useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/** A ref key derived from an element name: "Nút Lưu" → el_Nut_Luu. */
export function refFromName(name: string, taken: ReadonlySet<string>): string {
  const base = `el_${
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'phan_tu'
  }`;
  let ref = base;
  for (let n = 2; taken.has(ref); n++) ref = `${base}_${n}`;
  return ref;
}

/** Element library + "where used" (J-01, J-02). */
export function ElementsScreen() {
  const tx = useTx();
  const qc = useQueryClient();
  const projectId = useAppStore((s) => s.projectId) ?? '';
  const openTestId = useAppStore((s) => s.openTestId);
  const openTest = useAppStore((s) => s.openTest);
  const lib = useQuery({ ...trpc.elements.list.queryOptions({ projectId }), enabled: !!projectId });
  const test = useQuery({
    ...trpc.testCases.get.queryOptions({ id: openTestId ?? '' }),
    enabled: !!openTestId,
  });

  const saveDoc = async (content: TestCase) => {
    if (!test.data) return;
    try {
      const row = await trpcClient.testCases.save.mutate({
        id: test.data.id,
        version: test.data.version,
        content,
      });
      qc.setQueryData(trpc.testCases.get.queryKey({ id: row.id }), row);
    } catch (err) {
      toast.error(errorMessage(err, tx));
    }
  };

  const testElements = test.data ? Object.entries(test.data.content.elements) : [];
  const libEmpty = (lib.data?.length ?? 0) === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="border-b px-4 py-3">
        <h1 className="text-base font-semibold">{tx('ui.elements.title')}</h1>
      </header>
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        <section aria-labelledby="el-test">
          <h2 id="el-test" className="mb-2 text-sm font-semibold">
            {tx('ui.elements.inTest')}
            {test.data && (
              <span className="font-normal text-muted-foreground"> · {test.data.name}</span>
            )}
          </h2>
          {!openTestId && (
            <p className="text-sm text-muted-foreground">{tx('ui.elements.openTestFirst')}</p>
          )}
          {test.data && testElements.length === 0 && (
            <p className="text-sm text-muted-foreground">{tx('ui.elements.emptyText')}</p>
          )}
          <ul className="flex flex-col gap-2">
            {test.data &&
              testElements.map(([ref, el]) => {
                const used = elementUsages(test.data.content, ref);
                return (
                  <li key={ref} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Crosshair className="size-4 text-muted-foreground" aria-hidden />
                      <Input
                        className="h-8 flex-1 font-medium"
                        defaultValue={el.name}
                        aria-label={tx('ui.params.name')}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (!name || name === el.name || !test.data) return;
                          const content = structuredClone(test.data.content);
                          (content.elements[ref] as { name: string }).name = name;
                          void saveDoc(content);
                        }}
                      />
                      <Badge variant="secondary">
                        {tx('ui.elements.strategies', { count: el.strategies.length })}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tx('ui.actions.delete')}
                        disabled={used.length > 0}
                        title={used.length > 0 ? tx('ui.elements.cannotDelete') : undefined}
                        onClick={() => {
                          if (!test.data) return;
                          const content = structuredClone(test.data.content);
                          delete content.elements[ref];
                          void saveDoc(content);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {used.length ? (
                        <>
                          {tx('ui.elements.usedIn')}:{' '}
                          {used.map((no) => (
                            <button
                              key={no}
                              type="button"
                              className="mr-1 underline"
                              onClick={() => openTest(test.data?.id ?? null)}
                            >
                              {tx('ui.elements.step', { no })}
                            </button>
                          ))}
                        </>
                      ) : (
                        tx('ui.elements.unused')
                      )}
                    </p>
                  </li>
                );
              })}
          </ul>
        </section>

        <section aria-labelledby="el-project">
          <h2 id="el-project" className="mb-2 text-sm font-semibold">
            {tx('ui.elements.inProject')}
          </h2>
          {libEmpty ? (
            <EmptyState
              icon={Crosshair}
              title={tx('ui.elements.emptyTitle')}
              text={tx('ui.elements.emptyText')}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {(lib.data ?? []).map((el) => (
                <li key={el.id} className="flex items-center gap-2 rounded-lg border p-3">
                  <Crosshair className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate text-sm font-medium">{el.name}</span>
                  <Badge variant="secondary">
                    {tx('ui.elements.strategies', { count: el.locator.strategies.length })}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!test.data}
                    onClick={() => {
                      if (!test.data) return;
                      const content = structuredClone(test.data.content);
                      const ref = refFromName(el.name, new Set(Object.keys(content.elements)));
                      content.elements[ref] = { ...el.locator, name: el.name };
                      void saveDoc(content);
                    }}
                  >
                    <Plus /> {tx('ui.elements.copyToTest')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tx('ui.actions.delete')}
                    onClick={async () => {
                      try {
                        await trpcClient.elements.remove.mutate({ id: el.id });
                        await qc.invalidateQueries({
                          queryKey: trpc.elements.list.queryKey({ projectId }),
                        });
                      } catch (err) {
                        toast.error(errorMessage(err, tx));
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
