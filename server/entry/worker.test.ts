/// <reference types="@cloudflare/workers-types" />

import { beforeEach, describe, expect, it, vi } from 'vitest';

const tick = vi.fn(async () => {});
let background: ((task: Promise<unknown>) => void) | undefined;

vi.mock('cloudflare:workers', () => ({
  WorkerEntrypoint: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));
vi.mock('../application/app-service', () => ({
  AppService: class {
    constructor(ctx: { background: (task: Promise<unknown>) => void }) {
      background = ctx.background;
    }
    tick = tick;
  },
}));
vi.mock('../infrastructure/d1-sql', () => ({ d1Sql: () => ({}) }));
vi.mock('../infrastructure/r2-raw-store', () => ({ r2RawStore: () => ({}) }));
vi.mock('../infrastructure/pluggy-client', () => ({ pluggyClient: () => ({}) }));

const { Cron, default: worker, runCron } = await import('./worker');

const env = { DB: {}, RAW: {} } as never;
const makeCtx = () => ({ waitUntil: vi.fn(), passThroughOnException: vi.fn() }) as unknown as ExecutionContext;

beforeEach(() => {
  tick.mockClear();
  background = undefined;
});

describe('cron', () => {
  it('runCron ticks the service and hands background work to waitUntil', async () => {
    const ctx = makeCtx();
    await runCron(env, ctx);
    expect(tick).toHaveBeenCalledTimes(1);
    const task = Promise.resolve();
    background?.(task);
    expect(ctx.waitUntil).toHaveBeenCalledWith(task);
  });

  it('scheduled() does the same as runCron', async () => {
    const ctx = makeCtx();
    await worker.scheduled!({} as ScheduledController, env, ctx);
    expect(tick).toHaveBeenCalledTimes(1);
    const task = Promise.resolve();
    background?.(task);
    expect(ctx.waitUntil).toHaveBeenCalledWith(task);
  });

  it('Cron.tick() runs runCron with its own env and ctx', async () => {
    const ctx = makeCtx();
    await new Cron(ctx, env).tick();
    expect(tick).toHaveBeenCalledTimes(1);
    const task = Promise.resolve();
    background?.(task);
    expect(ctx.waitUntil).toHaveBeenCalledWith(task);
  });
});
