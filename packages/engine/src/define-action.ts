import type { Step } from '@kiemi/schema';
import type { z } from 'zod';
import { EngineError } from './errors';
import type { LogLevel } from './events';

/** What an action receives while it runs. Browser handles are added in M1-04. */
export interface ActionContext {
  readonly step: Step;
  /** Session (browser context) this step runs in [F-01]. */
  readonly session: string;
  /** Effective timeout for this step in milliseconds [D-07]. */
  readonly timeoutMs: number;
  /** Aborted when the step times out or the run is cancelled. */
  readonly signal: AbortSignal;
  log(message: string, level?: LogLevel): void;
}

export interface ActionUi {
  /** i18n key of the action label shown in the step table. */
  label: string;
  /** Lucide icon name. */
  icon: string;
  /** Group in the "add step" menu, e.g. `navigation`, `input`, `assert`. */
  group: string;
}

export interface ActionDefinition<P extends z.ZodType = z.ZodType> {
  type: string;
  params: P;
  ui: ActionUi;
  execute(params: z.output<P>, ctx: ActionContext): Promise<void> | void;
}

/** Declares an action plugin; `params` drives both validation and the generated UI form. */
export function defineAction<P extends z.ZodType>(def: ActionDefinition<P>): ActionDefinition<P> {
  return def;
}

// biome-ignore lint/suspicious/noExplicitAny: registry stores actions with heterogeneous param schemas.
type AnyAction = ActionDefinition<any>;

export class ActionRegistry {
  readonly #actions = new Map<string, AnyAction>();

  constructor(actions: readonly AnyAction[] = []) {
    for (const a of actions) this.register(a);
  }

  register(action: AnyAction): this {
    if (this.#actions.has(action.type)) {
      throw new EngineError('ENGINE_ERROR', `Action "${action.type}" is already registered`, {
        action: action.type,
      });
    }
    this.#actions.set(action.type, action);
    return this;
  }

  has(type: string): boolean {
    return this.#actions.has(type);
  }

  get(type: string): AnyAction | undefined {
    return this.#actions.get(type);
  }

  list(): AnyAction[] {
    return [...this.#actions.values()];
  }
}
