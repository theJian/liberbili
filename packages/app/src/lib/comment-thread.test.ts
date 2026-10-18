import { describe, expect, test } from 'bun:test';
import type { Comment, PageResult } from '@liberbili/api/types';
import { CommentThread, mergeComments } from './comment-thread';
const comment = (id: string, pinned = false): Comment => ({
  id,
  pinned,
  oid: 42,
  root: 1,
  author: 'Author',
  authorId: '1',
  authorUrl: '',
  avatar: '',
  message: id,
  likes: 0,
  createdAt: 0,
  replyCount: 0,
  pictures: [],
  pictureDetails: [],
  replies: [],
});

describe('video-scoped comments', () => {
  test('merges pinned copies and overlaps without losing the pin or stable order', () => {
    const merged = mergeComments(
      [comment('pinned', true), comment('normal')],
      [comment('pinned'), comment('new'), comment('normal')],
    );
    expect(merged.map((item) => item.id)).toEqual(['pinned', 'normal', 'new']);
    expect(merged[0].pinned).toBe(true);
  });
  test('keeps late video responses isolated from the current thread', async () => {
    let resolve!: (value: PageResult<Comment>) => void;
    const old = new CommentThread(
      'old',
      1,
      () =>
        new Promise((yes) => {
          resolve = yes;
        }),
    );
    const current = new CommentThread('new', 2, async () => ({
      items: [comment('current')],
    }));
    const pending = old.load();
    expect(current.getSnapshot().items).toEqual([]);
    expect(current.getSnapshot().next).toBeUndefined();
    await current.load();
    resolve({ items: [comment('stale')], next: 'stale-cursor' });
    await pending;
    expect(current.getSnapshot().items.map((item) => item.id)).toEqual([
      'current',
    ]);
    expect(current.getSnapshot().next).toBeUndefined();
  });
  test('only issues one concurrent page and stops repeated cursor loops', async () => {
    let resolve!: (value: PageResult<Comment>) => void;
    const calls: unknown[] = [];
    const thread = new CommentThread('video', 42, async (aid, cursor) => {
      calls.push([aid, cursor]);
      if (!cursor) return { items: [comment('pin', true)], next: 'A' };
      return new Promise((yes) => {
        resolve = yes;
      });
    });
    await thread.load();
    const pending = thread.more();
    await thread.more();
    resolve({ items: [comment('pin'), comment('two')], next: 'A' });
    await pending;
    await thread.more();
    expect(calls).toEqual([
      [42, undefined],
      [42, 'A'],
    ]);
    expect(thread.getSnapshot().items.map((item) => item.id)).toEqual([
      'pin',
      'two',
    ]);
    expect(thread.getSnapshot().items[0].pinned).toBe(true);
  });
  test('catches pagination errors and retry resumes the failed cursor', async () => {
    let fail = true;
    const cursors: (string | undefined)[] = [];
    const thread = new CommentThread('video', 42, async (_, cursor) => {
      cursors.push(cursor);
      if (!cursor) return { items: [comment('one')], next: 'next' };
      if (fail) throw new Error('offline');
      return { items: [comment('two')] };
    });
    await thread.load();
    await thread.more();
    expect(thread.getSnapshot().error?.message).toBe('offline');
    expect(thread.getSnapshot().items).toHaveLength(1);
    await thread.more();
    expect(cursors).toEqual([undefined, 'next']);
    fail = false;
    await thread.load();
    expect(cursors).toEqual([undefined, 'next', 'next']);
    expect(thread.getSnapshot().error).toBeUndefined();
    expect(thread.getSnapshot().items).toHaveLength(2);
  });
  test('first-page failure retries from the beginning; missing aid never requests', async () => {
    let count = 0;
    const fetch = async () => {
      if (++count === 1) throw new Error('offline');
      return { items: [] };
    };
    const pending = new CommentThread('video', undefined, fetch);
    await pending.load();
    expect(count).toBe(0);
    const thread = new CommentThread('video', 42, fetch);
    await thread.load();
    expect(thread.getSnapshot().error?.message).toBe('offline');
    await thread.load();
    expect(thread.getSnapshot()).toEqual({
      items: [],
      next: undefined,
      loading: false,
      started: true,
    });
  });
});
