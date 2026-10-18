import { expect, test } from 'bun:test';
import type { PageResult, VideoSummary } from '@liberbili/api/types';
import { CreatorUploads, isCreatorId } from './creator-uploads';
const video = (bvid: string, aid = 1): VideoSummary => ({
  bvid,
  aid,
  title: bvid,
  uploader: '',
  thumbnail: '',
  duration: 0,
  views: 0,
});

test('deduplicates concurrent uploads and repeated cursor loops', async () => {
  let resolve!: (value: PageResult<VideoSummary>) => void;
  let requests = 0;
  const uploads = new CreatorUploads(async (cursor) => {
    requests++;
    if (!cursor) return { items: [video('one', 42)], next: 'client:42' };
    return new Promise((yes) => {
      resolve = yes;
    });
  });
  await uploads.load();
  const pending = uploads.more();
  await uploads.more();
  expect(requests).toBe(2);
  resolve({ items: [video('one'), video('two')], next: 'client:42' });
  await pending;
  expect(uploads.getSnapshot().items.map((item) => item.bvid)).toEqual([
    'one',
    'two',
  ]);
  await uploads.more();
  expect(requests).toBe(2);
});

test('retries a failed page with the same cursor and final archive ID', async () => {
  const calls: unknown[] = [];
  let failed = false;
  const uploads = new CreatorUploads(async (cursor, lastAid) => {
    calls.push([cursor, lastAid]);
    if (!cursor) return { items: [video('one', 42)], next: '2' };
    if (!failed) {
      failed = true;
      throw new Error('offline');
    }
    return { items: [video('two', 43)] };
  });
  await uploads.load();
  await uploads.more();
  await uploads.more();
  expect(uploads.getSnapshot().error?.message).toBe('offline');
  expect(uploads.getSnapshot().items).toHaveLength(1);
  await uploads.load();
  expect(calls).toEqual([
    [undefined, undefined],
    ['2', 42],
    ['2', 42],
  ]);
  expect(uploads.getSnapshot().items).toHaveLength(2);
});

test('new creator instances do not receive late results for another creator', async () => {
  let resolve!: (value: PageResult<VideoSummary>) => void;
  const old = new CreatorUploads(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  const current = new CreatorUploads(async () => ({
    items: [video('current')],
  }));
  const pending = old.load();
  await current.load();
  resolve({ items: [video('old')] });
  await pending;
  expect(current.getSnapshot().items[0].bvid).toBe('current');
});

test('creator IDs require positive safe integers', () => {
  expect(isCreatorId('77')).toBe(true);
  for (const value of ['0', '-1', '1.2', 'hello', '99999999999999999999'])
    expect(isCreatorId(value)).toBe(false);
});
