/**
 * Removes anything personal from a crash report before it leaves the computer [N-09, N-07]:
 * no user / machine name, no breadcrumbs (they may hold page addresses or typed values),
 * home folder → `~`, URLs and e-mail addresses masked in messages.
 */

interface Frame {
  filename?: string;
  abs_path?: string;
  vars?: unknown;
  pre_context?: unknown;
  context_line?: unknown;
  post_context?: unknown;
}

export interface ScrubbableEvent {
  message?: string;
  user?: unknown;
  server_name?: string;
  request?: unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
  tags?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  exception?: { values?: { value?: string; stacktrace?: { frames?: Frame[] } }[] };
}

/** Contexts kept: enough to reproduce (versions, OS), nothing identifying. */
const KEEP_CONTEXTS = new Set(['os', 'runtime', 'app', 'electron', 'chrome', 'node']);
const KEEP_CONTEXT_FIELDS = new Set(['name', 'version', 'build', 'app_version', 'type']);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createScrubber(homeDir: string) {
  const homes = [homeDir, homeDir.replace(/\\/g, '/'), homeDir.replace(/\\/g, '\\\\')]
    .filter((h) => h.length > 1)
    .map((h) => new RegExp(escapeRegExp(h), 'gi'));

  const text = (s: string | undefined): string | undefined => {
    if (s === undefined) return s;
    let out = s;
    for (const h of homes) out = out.replace(h, '~');
    return out
      .replace(/\b(?:https?|wss?|file):\/\/[^\s'"<>)]+/gi, '<url>')
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>');
  };

  return function scrub<T extends ScrubbableEvent>(event: T): T {
    delete event.user;
    delete event.server_name;
    delete event.request;
    delete event.breadcrumbs;
    delete event.extra;
    if (event.message !== undefined) event.message = text(event.message) ?? '';
    if (event.contexts) {
      const kept: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(event.contexts)) {
        if (!KEEP_CONTEXTS.has(k) || typeof v !== 'object' || v === null) continue;
        kept[k] = Object.fromEntries(
          Object.entries(v).filter(([field]) => KEEP_CONTEXT_FIELDS.has(field)),
        );
      }
      event.contexts = kept;
    }
    for (const ex of event.exception?.values ?? []) {
      if (ex.value !== undefined) ex.value = text(ex.value) ?? '';
      for (const f of ex.stacktrace?.frames ?? []) {
        if (f.filename !== undefined) f.filename = text(f.filename) ?? '';
        if (f.abs_path !== undefined) f.abs_path = text(f.abs_path) ?? '';
        delete f.vars;
        delete f.pre_context;
        delete f.context_line;
        delete f.post_context;
      }
    }
    return event;
  };
}
