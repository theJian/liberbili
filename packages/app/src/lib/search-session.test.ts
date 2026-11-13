import { describe, expect, test } from 'bun:test';
import type { PageResult, VideoSummary } from '@liberbili/api/types';
import {
  readRecentSearches,
  rememberSearch,
  SearchSession,
} from './search-session';

const selection = {
  query: 'cats',
  order: 'click' as const,
  duration: 1 as const,
};
const video = (bvid: string): VideoSummary => ({
  bvid,
  aid: 1,
  title: bvid,
  thumbnail: '',
  uploader: '',
  duration: 1,
  views: 0,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe('recent searches', () => {
  test('validates persisted values and handles corrupt storage', () => {
    expect(readRecentSearches('{')).toEqual([]);
    expect(readRecentSearches('{}')).toEqual([]);
    expect(
      readRecentSearches('[null, 4, " cats ", "", "cats", "dogs"]'),
    ).toEqual(['cats', 'dogs']);
  });
  test('moves reused queries first and bounds history', () => {
    const history = Array.from({ length: 20 }, (_, i) => String(i));
    expect(rememberSearch(history, ' 5 ')).toEqual([
      '5',
      ...history.filter((item) => item !== '5'),
    ]);
    expect(rememberSearch(history, 'new')).toHaveLength(20);
    expect(rememberSearch(history, '  ')).toEqual(history);
  });
});
describe('submitted search pagination', () => {
  test('a newer search wins even if the old search finishes last', async () => {
    const old = deferred<PageResult<VideoSummary>>();
    const session = new SearchSession(async ({ query }) =>
      query === 'cats' ? old.promise : { items: [video('dog')] },
    );
    const first = session.submit(selection);
    await session.submit({ ...selection, query: 'dogs' });
    old.resolve({ items: [video('cat')], next: '2' });
    await first;
    expect(session.getSnapshot().items.map((item) => item.bvid)).toEqual([
      'dog',
    ]);
    expect(session.getSnapshot().selection?.query).toBe('dogs');
  });
  test('keeps submitted filters across pages and deduplicates concurrent loads and results', async () => {
    const calls: unknown[] = [];
    const pageTwo = deferred<PageResult<VideoSummary>>();
    const session = new SearchSession(async (submitted, page) => {
      calls.push([submitted, page]);
      return page === 1
        ? { items: [video('one')], next: '2' }
        : pageTwo.promise;
    });
    await session.submit(selection);
    const more = session.more();
    await session.more();
    pageTwo.resolve({ items: [video('one'), video('two')], next: '2' });
    await more;
    expect(calls).toEqual([
      [selection, 1],
      [selection, 2],
    ]);
    expect(session.getSnapshot().items.map((item) => item.bvid)).toEqual([
      'one',
      'two',
    ]);
    expect(session.getSnapshot().next).toBeUndefined();
  });
  test('failed pagination retains results and retries the same page', async () => {
    let fail = true;
    const calls: number[] = [];
    const session = new SearchSession(async (_, page) => {
      calls.push(page);
      if (page === 2 && fail) throw new Error('offline');
      return {
        items: [video(String(page))],
        next: page === 1 ? '2' : undefined,
      };
    });
    await session.submit(selection);
    await session.more();
    expect(session.getSnapshot().items).toHaveLength(1);
    expect(session.getSnapshot().error?.message).toBe('offline');
    await session.more();
    expect(calls).toEqual([1, 2]);
    fail = false;
    await session.retry();
    expect(calls).toEqual([1, 2, 2]);
    expect(session.getSnapshot().items).toHaveLength(2);
  });
  test('a stale rejection cannot replace current results with an error', async () => {
    const old = deferred<PageResult<VideoSummary>>();
    const session = new SearchSession(async ({ duration }) =>
      duration === 1 ? old.promise : { items: [video('new')] },
    );
    const pending = session.submit(selection);
    await session.submit({ ...selection, duration: 2 });
    old.reject(new Error('late error'));
    await pending;
    expect(session.getSnapshot().error).toBeUndefined();
    expect(session.getSnapshot().items[0].bvid).toBe('new');
  });
});
