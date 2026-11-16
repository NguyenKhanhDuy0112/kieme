import { createMemoryServices } from '@kiemi/db';
import type { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import { createCaller } from './root';

const { services, defaultProjectId } = createMemoryServices();
const caller = createCaller({
  appVersion: '1.2.3',
  platform: 'darwin',
  services,
  defaultProjectId,
});

describe('app router', () => {
  it('returns app info from context', async () => {
    await expect(caller.app.info()).resolves.toEqual({
      name: 'Kiemi',
      version: '1.2.3',
      platform: 'darwin',
      defaultProjectId,
    });
  });

  it('echoes a valid, trimmed message', async () => {
    const res = await caller.app.echo({ message: '  xin chào  ' });
    expect(res.message).toBe('xin chào');
    expect(Number.isNaN(Date.parse(res.receivedAt))).toBe(false);
  });

  it('rejects invalid input with BAD_REQUEST', async () => {
    await expect(caller.app.echo({ message: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    } satisfies Partial<TRPCError>);
  });
});
