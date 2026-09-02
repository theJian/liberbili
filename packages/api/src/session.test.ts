import { describe, expect, test } from 'bun:test';

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
