import { describe, expect, test } from 'bun:test';
import { ResourceRequest, sameResourceDependencies } from './resource-request';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('dependency-scoped resources', () => {
  test('a new key starts empty and loading before its request starts', async () => {
    const previous = new ResourceRequest<string>();
    await previous.run(async () => 'previous video');
    const current = new ResourceRequest<string>();
    expect(current.getSnapshot()).toEqual({ loading: true });
    expect(previous.getSnapshot().data).toBe('previous video');
    await current.run(async () => 'current video');
    expect(current.getSnapshot()).toEqual({
      loading: false,
      data: 'current video',
    });
  });
  test('retry rejects late success and preserves current data while refreshing', async () => {
    const resource = new ResourceRequest<string>();
    await resource.run(async () => 'cached');
    const first = deferred<string>();
    const second = deferred<string>();
    const old = resource.run(() => first.promise);
    expect(resource.getSnapshot()).toEqual({ data: 'cached', loading: true });
    const pending = resource.run(() => second.promise);
    second.resolve('fresh');
    await pending;
    first.resolve('stale');
    await old;
    expect(resource.getSnapshot()).toEqual({ data: 'fresh', loading: false });
  });
  test('aborted requests cannot publish errors even when loaders ignore abort', async () => {
    const resource = new ResourceRequest<string>();
    const stale = deferred<string>();
    let signal!: AbortSignal;
    const pending = resource.run((value) => {
      signal = value;
      return stale.promise;
    });
    await resource.run(async () => 'new');
    expect(signal.aborted).toBe(true);
    stale.reject(new Error('late error'));
    await pending;
    expect(resource.getSnapshot().error).toBeUndefined();
    expect(resource.getSnapshot().data).toBe('new');
  });
  test('unmounted resource cancels publication and removes subscribers', async () => {
    const resource = new ResourceRequest<string>();
    const pending = deferred<string>();
    let updates = 0;
    const unsubscribe = resource.subscribe(() => updates++);
    const running = resource.run(() => pending.promise);
    expect(updates).toBe(1);
    unsubscribe();
    resource.cancel();
    pending.resolve('late');
    await running;
    expect(updates).toBe(1);
    expect(resource.getSnapshot().data).toBeUndefined();
  });
  test('synchronous loader failures settle and can be retried', async () => {
    const resource = new ResourceRequest<string>();
    await resource.run(() => {
      throw new Error('offline');
    });
    expect(resource.getSnapshot().error?.message).toBe('offline');
    expect(resource.getSnapshot().loading).toBe(false);
    await resource.run(async () => 'recovered');
    expect(resource.getSnapshot()).toEqual({
      loading: false,
      data: 'recovered',
    });
  });
});

test('dependency keys use React Object.is semantics rather than serialized values', () => {
  const reference = {};
  expect(
    sameResourceDependencies(['BV1', reference, NaN], ['BV1', reference, NaN]),
  ).toBe(true);
  expect(sameResourceDependencies(['BV1'], ['BV2'])).toBe(false);
  expect(sameResourceDependencies([{}], [{}])).toBe(false);
  expect(sameResourceDependencies([0], [-0])).toBe(false);
  expect(sameResourceDependencies([], ['new'])).toBe(false);
});

test('refresh failures preserve cached results and expose an error for retry', async () => {
  const resource = new ResourceRequest<string[]>();
  await resource.run(async () => ['cached']);
  await resource.run(async () => {
    throw new Error('offline');
  });
  expect(resource.getSnapshot().data).toEqual(['cached']);
  expect(resource.getSnapshot().error?.message).toBe('offline');
  expect(resource.getSnapshot().loading).toBe(false);
});
