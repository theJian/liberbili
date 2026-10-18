import { afterEach, describe, expect, test } from 'bun:test';

import { BilibiliStorage, SessionManager } from './session';

const sessionKey = '@liberbili/session/v1';

function createStorage(initial: Record<string, string> = {}): BilibiliStorage {
  const values = new Map(Object.entries(initial));
  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}

describe('Bilibili session storage', () => {
  test('loads and clears a persisted session through the storage adapter', async () => {
    const session = {
      userAgent: 'LiberBili test',
      cookie: 'buvid3=test',
      expiresAt: Date.now() / 1000 + 3600,
    };
    const storage = createStorage({ [sessionKey]: JSON.stringify(session) });
    const manager = new SessionManager(storage);

    await expect(manager.get()).resolves.toEqual(session);
    manager.clear();
    expect(storage.getString(sessionKey)).toBeUndefined();
  });
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const now = () => Math.floor(Date.now() / 1000);
const validSession = () => ({
  userAgent: 'test-agent',
  cookie: 'buvid3=saved',
  expiresAt: now() + 3600,
});
const spi = (id = 'anonymous') => ({
  code: 0,
  data: { b_3: id, b_4: `${id}-four` },
});
const ticket = () => ({
  code: 0,
  data: { ticket: 'test-ticket', created_at: now(), ttl: 3600 },
});
const nav = (code = 0) => ({
  code,
  data: {
    wbi_img: {
      img_url: `https://i0.hdslb.com/bfs/wbi/${'a'.repeat(32)}.png`,
      sub_url: `https://i0.hdslb.com/bfs/wbi/${'b'.repeat(32)}.png`,
    },
  },
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fakeFetch(handler: (url: string) => Promise<Response> | Response) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
  return calls;
}
const normalResponse = (url: string) =>
  Response.json(
    url.endsWith('/spi') ? spi() : url.endsWith('/nav') ? nav() : ticket(),
  );

describe('Bilibili session single-flight and recovery', () => {
  test('shares one bootstrap among concurrent normal and forced callers', async () => {
    const gate = deferred<Response>();
    const calls = fakeFetch((url) =>
      url.endsWith('/spi') ? gate.promise : normalResponse(url),
    );
    const manager = new SessionManager(createStorage());
    const first = manager.get();
    const rest = Array.from({ length: 8 }, (_, index) =>
      manager.get(index % 2 === 0),
    );
    expect(calls).toHaveLength(1);
    gate.resolve(Response.json(spi()));
    const results = await Promise.all([first, ...rest]);
    expect(calls).toHaveLength(2);
    for (const result of results) expect(result).toBe(results[0]);
    expect(results[0].cookie).toContain('buvid3=anonymous');
    expect(results[0].cookie).not.toContain('undefined');
  });

  test('headers and WBI callers share one bootstrap and one nav request', async () => {
    const gate = deferred<Response>();
    const calls = fakeFetch((url) =>
      url.endsWith('/spi') ? gate.promise : normalResponse(url),
    );
    const manager = new SessionManager(createStorage());
    const keys = [manager.getMixinKey(), manager.getMixinKey()];
    const headers = manager.headers();
    gate.resolve(Response.json(spi()));
    const [first, second] = await Promise.all(keys);
    expect(first).toHaveLength(32);
    expect(second).toBe(first);
    expect((await headers).Cookie).toContain('buvid3=anonymous');
    expect(calls.filter((url) => url.endsWith('/spi'))).toHaveLength(1);
    expect(calls.filter((url) => url.endsWith('/nav'))).toHaveLength(1);
    expect(await manager.getMixinKey()).toBe(first);
    expect(calls).toHaveLength(3);
  });

  test('recovers corrupted, incomplete and expired saved sessions', async () => {
    fakeFetch(normalResponse);
    for (const raw of [
      '{',
      'null',
      '{}',
      JSON.stringify({ ...validSession(), cookie: undefined }),
      JSON.stringify({ ...validSession(), expiresAt: 'tomorrow' }),
      JSON.stringify({ ...validSession(), expiresAt: now() - 1 }),
      JSON.stringify({ ...validSession(), userAgent: 'bad\r\nagent' }),
    ]) {
      const storage = createStorage({ [sessionKey]: raw });
      const manager = new SessionManager(storage);
      expect((await manager.get()).cookie).toContain('buvid3=anonymous');
      expect(JSON.parse(storage.getString(sessionKey)!)).toHaveProperty(
        'userAgent',
      );
    }
  });

  test('drops malformed saved signing metadata without losing a usable session', async () => {
    const calls = fakeFetch(() => {
      throw new Error('should not fetch');
    });
    const manager = new SessionManager(
      createStorage({
        [sessionKey]: JSON.stringify({
          ...validSession(),
          mixinKey: 'short',
          mixinDate: 'today',
        }),
      }),
    );
    expect(await manager.get()).toEqual(validSession());
    expect(calls).toHaveLength(0);
  });

  test('rejects malformed fingerprint data before ticket fetch or persistence', async () => {
    for (const body of [
      null,
      {},
      { code: -412, data: spi().data },
      { data: { b_3: 'only-one' } },
      { data: { b_3: 'bad;cookie', b_4: 'four' } },
    ]) {
      const calls = fakeFetch(() => Response.json(body));
      const storage = createStorage();
      await expect(new SessionManager(storage).get()).rejects.toThrow(
        'invalid fingerprint',
      );
      expect(storage.getString(sessionKey)).toBeUndefined();
      expect(calls).toHaveLength(1);
    }
  });

  test('failed bootstrap releases the single-flight promise so a retry succeeds', async () => {
    let failed = true;
    fakeFetch((url) =>
      failed ? new Response('', { status: 503 }) : normalResponse(url),
    );
    const manager = new SessionManager(createStorage());
    await expect(manager.get()).rejects.toThrow('503');
    failed = false;
    expect((await manager.get()).cookie).toContain('buvid3=anonymous');
  });

  test('malformed optional tickets never cache undefined cookies or invalid expiry', async () => {
    for (const body of [
      null,
      {},
      { data: {} },
      { code: -400, data: ticket().data },
      { data: { ticket: 'bad;cookie', created_at: now(), ttl: 300 } },
    ]) {
      fakeFetch((url) =>
        url.endsWith('/spi') ? Response.json(spi()) : Response.json(body),
      );
      const session = await new SessionManager(createStorage()).get();
      expect(session.cookie).not.toContain('undefined');
      expect(session.cookie).not.toContain('bili_ticket=');
      expect(session.expiresAt).toBeGreaterThan(now());
    }
  });

  test('optional ticket network failure falls back to a fingerprint-only session', async () => {
    fakeFetch((url) => {
      if (url.endsWith('/spi')) return Response.json(spi());
      throw new Error('ticket service offline');
    });
    const storage = createStorage();
    const session = await new SessionManager(storage).get();
    expect(session.cookie).toContain('buvid3=anonymous');
    expect(session.cookie).not.toContain('bili_ticket=');
    expect(JSON.parse(storage.getString(sessionKey)!)).toEqual(session);
  });

  test('rejects malformed nav data and permits a subsequent valid retry', async () => {
    for (const body of [
      null,
      {},
      { code: -400, data: nav().data },
      { data: { wbi_img: { img_url: 'bad', sub_url: 'bad' } } },
    ]) {
      let invalid = true;
      fakeFetch(() => Response.json(invalid ? body : nav(-101)));
      const storage = createStorage({
        [sessionKey]: JSON.stringify(validSession()),
      });
      const manager = new SessionManager(storage);
      await expect(manager.getMixinKey()).rejects.toThrow('invalid WBI');
      expect(
        JSON.parse(storage.getString(sessionKey)!).mixinKey,
      ).toBeUndefined();
      invalid = false;
      expect(await manager.getMixinKey()).toHaveLength(32);
    }
  });

  test('HTTP failure in WBI lookup releases pending work for retry', async () => {
    let failed = true;
    fakeFetch(() =>
      failed ? new Response('', { status: 403 }) : Response.json(nav()),
    );
    const manager = new SessionManager(
      createStorage({ [sessionKey]: JSON.stringify(validSession()) }),
    );
    await expect(manager.getMixinKey()).rejects.toThrow('403');
    failed = false;
    expect(await manager.getMixinKey()).toHaveLength(32);
  });
});

describe('session invalidation during pending work', () => {
  test('clear prevents stale fingerprint results from overwriting a new session', async () => {
    const gate = deferred<Response>();
    let spiCount = 0;
    fakeFetch((url) =>
      url.endsWith('/spi') && ++spiCount === 1
        ? gate.promise
        : url.endsWith('/spi')
          ? Response.json(spi('new'))
          : Response.json(ticket()),
    );
    const storage = createStorage();
    const manager = new SessionManager(storage);
    const stale = manager.get().catch((error: Error) => error);
    manager.clear();
    const fresh = await manager.get();
    gate.resolve(Response.json(spi('old')));
    expect(await stale).toBeInstanceOf(Error);
    expect(fresh.cookie).toContain('buvid3=new');
    expect(JSON.parse(storage.getString(sessionKey)!).cookie).toBe(
      fresh.cookie,
    );
  });

  test('clear also invalidates a bootstrap awaiting its ticket response', async () => {
    const gate = deferred<Response>();
    const started = deferred<void>();
    let ticketCount = 0;
    fakeFetch((url) => {
      if (url.endsWith('/spi')) return Response.json(spi());
      if (++ticketCount === 1) {
        started.resolve();
        return gate.promise;
      }
      return Response.json(ticket());
    });
    const storage = createStorage();
    const manager = new SessionManager(storage);
    const stale = manager.get().catch((error: Error) => error);
    await started.promise;
    manager.clear();
    const fresh = await manager.get();
    gate.resolve(Response.json(ticket()));
    expect(await stale).toBeInstanceOf(Error);
    expect(JSON.parse(storage.getString(sessionKey)!)).toEqual(fresh);
  });

  test('switching adapters cannot write an old bootstrap into either adapter', async () => {
    const gate = deferred<Response>();
    fakeFetch(() => gate.promise);
    const oldStorage = createStorage();
    const replacement = { ...validSession(), userAgent: 'replacement-agent' };
    const newStorage = createStorage({
      [sessionKey]: JSON.stringify(replacement),
    });
    const manager = new SessionManager(oldStorage);
    const stale = manager.get().catch((error: Error) => error);
    manager.configureStorage(newStorage);
    expect(await manager.get()).toEqual(replacement);
    gate.resolve(Response.json(spi('old')));
    expect(await stale).toBeInstanceOf(Error);
    expect(oldStorage.getString(sessionKey)).toBeUndefined();
    expect(JSON.parse(newStorage.getString(sessionKey)!)).toEqual(replacement);
  });

  test('switching adapters while nav is pending cannot persist stale signing keys', async () => {
    const gate = deferred<Response>();
    const started = deferred<void>();
    fakeFetch(() => {
      started.resolve();
      return gate.promise;
    });
    const oldStorage = createStorage({
      [sessionKey]: JSON.stringify(validSession()),
    });
    const replacement = { ...validSession(), userAgent: 'replacement-agent' };
    const newStorage = createStorage({
      [sessionKey]: JSON.stringify(replacement),
    });
    const manager = new SessionManager(oldStorage);
    const stale = manager.getMixinKey().catch((error: Error) => error);
    await started.promise;
    manager.configureStorage(newStorage);
    gate.resolve(Response.json(nav()));
    expect(await stale).toBeInstanceOf(Error);
    expect(JSON.parse(newStorage.getString(sessionKey)!)).toEqual(replacement);
    expect(
      JSON.parse(oldStorage.getString(sessionKey)!).mixinKey,
    ).toBeUndefined();
  });

  test('forced refresh invalidates a pending WBI lookup for the former session', async () => {
    const gate = deferred<Response>();
    const started = deferred<void>();
    fakeFetch((url) => {
      if (url.endsWith('/nav')) {
        started.resolve();
        return gate.promise;
      }
      return normalResponse(url);
    });
    const storage = createStorage({
      [sessionKey]: JSON.stringify(validSession()),
    });
    const manager = new SessionManager(storage);
    const stale = manager.getMixinKey().catch((error: Error) => error);
    await started.promise;
    const refreshed = await manager.get(true);
    gate.resolve(Response.json(nav()));
    expect(await stale).toBeInstanceOf(Error);
    expect((await manager.get()).cookie).toBe(refreshed.cookie);
    expect(JSON.parse(storage.getString(sessionKey)!).mixinKey).toBeUndefined();
  });
});
