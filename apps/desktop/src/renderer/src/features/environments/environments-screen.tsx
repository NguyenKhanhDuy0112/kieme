import type { SshHop, SshSettings } from '@kiemi/schema';
import { EmptyState } from '@renderer/components/empty-state';
import { NameDialog, type NameDialogState } from '@renderer/components/name-dialog';
import { Button } from '@renderer/components/ui/button';
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
import { errorMessage } from '@renderer/lib/errors';
import { useAppStore } from '@renderer/lib/store';
import { trpc, trpcClient } from '@renderer/lib/trpc';
import { useTx } from '@renderer/lib/tx';
import { cn } from '@renderer/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, KeyRound, Loader2, Plus, ServerCog, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const NONE = '__none__';

/** Environments with base URL, variables, secrets, proxy and SSH (S-06, G-06, G-07, G-08). */
export function EnvironmentsScreen() {
  const tx = useTx();
  const qc = useQueryClient();
  const projectId = useAppStore((s) => s.projectId) ?? '';
  const envs = useQuery({
    ...trpc.environments.list.queryOptions({ projectId }),
    enabled: !!projectId,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<NameDialogState | null>(null);
  const currentId = selected ?? envs.data?.[0]?.id ?? null;

  const refresh = () =>
    qc.invalidateQueries({ queryKey: trpc.environments.list.queryKey({ projectId }) });

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-60 shrink-0 border-r p-3" aria-label={tx('ui.nav.environments')}>
        <Button
          size="sm"
          className="mb-3 w-full"
          onClick={() =>
            setDialog({
              title: tx('ui.environments.new'),
              initial: 'UAT',
              onSubmit: async (name) => {
                try {
                  const env = await trpcClient.environments.create.mutate({ projectId, name });
                  await refresh();
                  setSelected(env.id);
                } catch (err) {
                  toast.error(errorMessage(err, tx));
                }
              },
            })
          }
        >
          <Plus /> {tx('ui.environments.new')}
        </Button>
        <ul className="flex flex-col gap-0.5">
          {(envs.data ?? []).map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  e.id === currentId && 'bg-accent font-medium',
                )}
                onClick={() => setSelected(e.id)}
              >
                <Globe className="size-4 text-muted-foreground" aria-hidden />
                <span className="truncate">{e.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">
        {currentId ? (
          <EnvironmentEditor key={currentId} id={currentId} onDeleted={() => setSelected(null)} />
        ) : (
          <EmptyState
            icon={Globe}
            title={tx('ui.environments.emptyTitle')}
            text={tx('ui.environments.emptyText')}
          />
        )}
      </div>
      <NameDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Globe;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden /> {title}
      </h2>
      {hint && <p className="mb-3 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function EnvironmentEditor({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const tx = useTx();
  const qc = useQueryClient();
  const projectId = useAppStore((s) => s.projectId) ?? '';
  const env = useQuery(trpc.environments.get.queryOptions({ id }));
  const [vars, setVars] = useState<[string, string][]>([]);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (env.data) setVars(Object.entries(env.data.variables));
  }, [env.data]);

  const reload = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trpc.environments.get.queryKey({ id }) }),
      qc.invalidateQueries({ queryKey: trpc.environments.list.queryKey({ projectId }) }),
    ]);
  const update = async (
    patch: Parameters<typeof trpcClient.environments.update.mutate>[0]['patch'],
  ) => {
    try {
      await trpcClient.environments.update.mutate({ id, patch });
      await reload();
      toast.success(tx('ui.actions.saved'));
    } catch (err) {
      toast.error(errorMessage(err, tx));
    }
  };

  if (!env.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  const e = env.data;
  const secretNames = e.secrets.map((s) => s.name);
  const ssh: SshSettings | null = e.ssh ?? null;
  const saveSsh = (next: SshSettings | null) => void update({ ssh: next });
  const defaultHop: SshHop = { host: '', port: 22, username: '', auth: 'password' };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="env-name">{tx('ui.environments.name')}</Label>
          <Input
            id="env-name"
            defaultValue={e.name}
            onBlur={(ev) =>
              ev.target.value.trim() &&
              ev.target.value !== e.name &&
              void update({ name: ev.target.value.trim() })
            }
          />
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await trpcClient.environments.remove.mutate({ id });
              await reload();
              onDeleted();
            } catch (err) {
              toast.error(errorMessage(err, tx));
            }
          }}
        >
          <Trash2 /> {tx('ui.actions.delete')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{tx('ui.environments.hint')}</p>

      <Section
        icon={Globe}
        title={tx('ui.environments.baseUrl')}
        hint={tx('ui.environments.baseUrlHint')}
      >
        <Input
          aria-label={tx('ui.environments.baseUrl')}
          placeholder={tx('ui.examples.baseUrl')}
          defaultValue={e.baseUrl ?? ''}
          onBlur={(ev) =>
            ev.target.value !== (e.baseUrl ?? '') &&
            void update({ baseUrl: ev.target.value.trim() || null })
          }
        />
      </Section>

      <Section icon={ServerCog} title={tx('ui.environments.variables')}>
        {vars.map(([k, v], i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional.
          <div key={i} className="flex gap-2">
            <Input
              className="w-56"
              aria-label={tx('ui.variables.name')}
              value={k}
              onChange={(ev) =>
                setVars(vars.map((r, j) => (j === i ? [ev.target.value, r[1]] : r)))
              }
            />
            <Input
              aria-label={tx('ui.variables.value')}
              value={v}
              onChange={(ev) =>
                setVars(vars.map((r, j) => (j === i ? [r[0], ev.target.value] : r)))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={tx('ui.actions.delete')}
              onClick={() => setVars(vars.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setVars([...vars, ['', '']])}>
            <Plus /> {tx('ui.variables.add')}
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              try {
                await trpcClient.environments.setVariables.mutate({
                  id,
                  variables: Object.fromEntries(vars.filter(([k]) => k.trim())),
                });
                await reload();
                toast.success(tx('ui.actions.saved'));
              } catch (err) {
                toast.error(errorMessage(err, tx));
              }
            }}
          >
            {tx('common.save')}
          </Button>
        </div>
      </Section>

      <Section
        icon={KeyRound}
        title={tx('ui.environments.secrets')}
        hint={tx('ui.environments.secretsHint')}
      >
        {e.secrets.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <code className="w-56 truncate rounded bg-muted px-2 py-1.5 text-xs">{`{{secret.${s.name}}}`}</code>
            <span className="flex-1 font-mono text-sm tracking-widest text-muted-foreground">
              ••••••••
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={tx('ui.actions.delete')}
              onClick={async () => {
                await trpcClient.environments.removeSecret.mutate({ id, name: s.name });
                await reload();
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            try {
              await trpcClient.environments.setSecret.mutate({
                id,
                name: secretName.trim(),
                value: secretValue,
              });
              toast.success(tx('ui.environments.secretSaved', { name: secretName.trim() }));
              setSecretName('');
              setSecretValue('');
              await reload();
            } catch (err) {
              toast.error(errorMessage(err, tx));
            }
          }}
        >
          <Input
            className="w-56"
            placeholder={tx('ui.environments.secretName')}
            aria-label={tx('ui.environments.secretName')}
            value={secretName}
            onChange={(ev) => setSecretName(ev.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={tx('ui.environments.secretValue')}
            aria-label={tx('ui.environments.secretValue')}
            value={secretValue}
            onChange={(ev) => setSecretValue(ev.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!secretName.trim() || !secretValue}>
            {tx('common.save')}
          </Button>
        </form>
      </Section>

      <Section icon={Globe} title={tx('ui.environments.proxy')}>
        <Input
          aria-label={tx('ui.environments.proxyServer')}
          placeholder={tx('ui.environments.proxyServer')}
          defaultValue={e.proxy?.server ?? ''}
          onBlur={(ev) => {
            const server = ev.target.value.trim();
            if (server === (e.proxy?.server ?? '')) return;
            void update({ proxy: server ? { ...(e.proxy ?? { bypass: [] }), server } : null });
          }}
        />
        {e.proxy && (
          <Input
            aria-label={tx('ui.environments.proxyBypass')}
            placeholder={tx('ui.environments.proxyBypass')}
            defaultValue={e.proxy.bypass.join(', ')}
            onBlur={(ev) => {
              const bypass = ev.target.value
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean);
              if (e.proxy) void update({ proxy: { ...e.proxy, bypass } });
            }}
          />
        )}
      </Section>

      <Section icon={ServerCog} title={tx('ui.environments.ssh.title')}>
        <div className="flex items-center justify-between">
          <Label htmlFor="ssh-on">{tx('ui.environments.ssh.enabled')}</Label>
          <Switch
            id="ssh-on"
            checked={ssh?.enabled === true}
            // Enabled once the SSH server below has been saved.
            disabled={!ssh}
            onCheckedChange={(on) => ssh && saveSsh({ ...ssh, enabled: on })}
          />
        </div>
        <SshHopForm
          idPrefix="ssh-target"
          hop={ssh?.target ?? defaultHop}
          secretNames={secretNames}
          onSave={(target) =>
            saveSsh({
              enabled: ssh?.enabled ?? true,
              target,
              ...(ssh?.jump ? { jump: ssh.jump } : {}),
            })
          }
        />
        {ssh && (
          <details className="rounded-md border p-3" open={!!ssh.jump}>
            <summary className="cursor-pointer text-sm font-medium">
              {tx('ui.environments.ssh.jump')}
            </summary>
            <div className="mt-3">
              <SshHopForm
                idPrefix="ssh-jump"
                hop={ssh.jump ?? defaultHop}
                secretNames={secretNames}
                onSave={(jump) => saveSsh({ ...ssh, jump })}
              />
            </div>
          </details>
        )}
        {ssh && (
          <Button
            variant="outline"
            className="self-start"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              try {
                const res = await trpcClient.system.testSsh.mutate({ environmentId: id });
                if (res.ok) toast.success(tx('ui.environments.ssh.ok', { ms: res.ms }));
                else toast.error(tx('ui.environments.ssh.failed', { reason: res.message }));
              } catch (err) {
                toast.error(errorMessage(err, tx));
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? <Loader2 className="animate-spin" /> : <ServerCog />}{' '}
            {testing ? tx('ui.environments.ssh.testing') : tx('ui.environments.ssh.test')}
          </Button>
        )}
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{tx('ui.environments.ssh.guideTitle')}</p>
          <p>{tx('ui.environments.ssh.guide1')}</p>
          <p>{tx('ui.environments.ssh.guide2')}</p>
          <p>{tx('ui.environments.ssh.guide3')}</p>
          <p>{tx('ui.environments.ssh.guide4')}</p>
        </div>
      </Section>
    </div>
  );
}

/** One SSH hop: host, port, user, password or key — credentials picked from secrets. */
function SshHopForm({
  idPrefix,
  hop,
  secretNames,
  onSave,
}: {
  idPrefix: string;
  hop: SshHop;
  secretNames: string[];
  onSave: (hop: SshHop) => void;
}) {
  const tx = useTx();
  const [h, setH] = useState<SshHop>(hop);
  const ready =
    h.host.trim() &&
    h.username.trim() &&
    (h.auth === 'password' ? h.passwordSecret : h.privateKeySecret);
  const secretSelect = (
    field: 'passwordSecret' | 'privateKeySecret' | 'passphraseSecret',
    label: string,
  ) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}-${field}`}>{label}</Label>
      <Select
        value={h[field] ?? NONE}
        onValueChange={(v) =>
          setH((cur) => {
            const next = { ...cur };
            if (v === NONE) delete next[field];
            else next[field] = v;
            return next;
          })
        }
      >
        <SelectTrigger id={`${idPrefix}-${field}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{tx('ui.environments.noSecret')}</SelectItem>
          {secretNames.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-host`}>{tx('ui.environments.ssh.host')}</Label>
        <Input
          id={`${idPrefix}-host`}
          value={h.host}
          placeholder={tx('ui.examples.sshHost')}
          onChange={(e) => setH({ ...h, host: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-port`}>{tx('ui.environments.ssh.port')}</Label>
        <Input
          id={`${idPrefix}-port`}
          type="number"
          min={1}
          max={65535}
          value={h.port}
          onChange={(e) => setH({ ...h, port: Number(e.target.value) || 22 })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-user`}>{tx('ui.environments.ssh.username')}</Label>
        <Input
          id={`${idPrefix}-user`}
          value={h.username}
          onChange={(e) => setH({ ...h, username: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-auth`}>{tx('ui.environments.ssh.auth')}</Label>
        <Select
          value={h.auth}
          onValueChange={(auth) => setH({ ...h, auth: auth as SshHop['auth'] })}
        >
          <SelectTrigger id={`${idPrefix}-auth`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="password">{tx('ui.enums.password')}</SelectItem>
            <SelectItem value="key">{tx('ui.enums.key')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {h.auth === 'password'
        ? secretSelect('passwordSecret', tx('ui.environments.ssh.passwordSecret'))
        : secretSelect('privateKeySecret', tx('ui.environments.ssh.keySecret'))}
      {h.auth === 'key' &&
        secretSelect('passphraseSecret', tx('ui.environments.ssh.passphraseSecret'))}
      <div className="col-span-2">
        <Button
          size="sm"
          disabled={!ready}
          onClick={() => onSave({ ...h, host: h.host.trim(), username: h.username.trim() })}
        >
          {tx('common.save')}
        </Button>
      </div>
    </div>
  );
}
