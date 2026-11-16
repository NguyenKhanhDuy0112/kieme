import { z } from 'zod';
import { sleep } from '../assertions/actions';
import { defineAction } from '../define-action';

/** Fixed wait in seconds [A-18]. Use sparingly — prefer "wait until". */
export const waitAction = defineAction({
  type: 'wait',
  params: z.object({ seconds: z.coerce.number().positive().max(600) }),
  ui: { label: 'actions.wait', icon: 'timer', group: 'flow' },
  // Not limited by the step timeout (a 30 s wait is allowed).
  container: true,
  async execute({ seconds }, ctx) {
    await sleep(seconds * 1000, ctx.signal);
  },
});
