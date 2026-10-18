import { describe, expect, test } from 'bun:test';
import type { VideoSummary } from '@liberbili/api/types';
import {
  createPlaybackTransitions,
  DEFAULT_PREFERENCES,
  moveInQueue,
  nextOnEnd,
  parsePlaybackPreferences,
  queueFor,
  removeFromQueue,
  sleepDeadline,
  sleepExpired,
  stopForSleep,
} from './playback';

const video = (bvid: string): VideoSummary => ({
  bvid,
  aid: 1,
  title: bvid,
  thumbnail: '',
  uploader: '',
  duration: 60,
  views: 0,
});
const queue = ['A', 'B', 'C'].map(video);
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('playback preferences and queue policy', () => {
  test('recovers corrupted preferences and rejects unsupported values', () => {
    expect(parsePlaybackPreferences('{')).toEqual(DEFAULT_PREFERENCES);
    expect(parsePlaybackPreferences('null')).toEqual(DEFAULT_PREFERENCES);
    expect(
      parsePlaybackPreferences('{"speed":100,"repeat":"bogus","autoplay":0}'),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(
      parsePlaybackPreferences('{"speed":1.5,"repeat":"one","autoplay":false}'),
    ).toEqual({ speed: 1.5, repeat: 'one', autoplay: false });
  });
  test('keeps the requested video in a deduplicated queue', () => {
    expect(queueFor(queue[1], [...queue, queue[1]])).toEqual({
      queue,
      index: 1,
    });
    expect(queueFor(video('D'), queue).queue.map((item) => item.bvid)).toEqual([
      'D',
      'A',
      'B',
      'C',
    ]);
  });
  test('advances, stops, repeats one or wraps all according to persisted policy', () => {
    expect(nextOnEnd({ queue, index: 0 }, DEFAULT_PREFERENCES)).toBe(1);
    expect(nextOnEnd({ queue, index: 2 }, DEFAULT_PREFERENCES)).toBeUndefined();
    expect(
      nextOnEnd({ queue, index: 2 }, { ...DEFAULT_PREFERENCES, repeat: 'all' }),
    ).toBe(0);
    expect(
      nextOnEnd({ queue, index: 1 }, { ...DEFAULT_PREFERENCES, repeat: 'one' }),
    ).toBe(1);
    expect(
      nextOnEnd(
        { queue, index: 1 },
        { ...DEFAULT_PREFERENCES, autoplay: false, repeat: 'one' },
      ),
    ).toBeUndefined();
    expect(
      nextOnEnd({ queue: [], index: -1 }, DEFAULT_PREFERENCES),
    ).toBeUndefined();
  });
  test('preserves current video while removing predecessors and picks a neighbor for active removal', () => {
    expect(removeFromQueue({ queue, index: 1 }, 0)).toEqual({
      queue: [queue[1], queue[2]],
      index: 0,
    });
    expect(removeFromQueue({ queue, index: 1 }, 1)).toEqual({
      queue: [queue[0], queue[2]],
      index: 1,
    });
    expect(removeFromQueue({ queue, index: 2 }, 2).index).toBe(1);
    expect(removeFromQueue({ queue: [queue[0]], index: 0 }, 0)).toEqual({
      queue: [],
      index: -1,
    });
    const state = { queue, index: 0 };
    expect(removeFromQueue(state, -1)).toBe(state);
  });
  test('reorders without changing the playing identity or mutating the source queue', () => {
    const moved = moveInQueue({ queue, index: 1 }, 1, 0);
    expect(moved.queue.map((item) => item.bvid)).toEqual(['B', 'A', 'C']);
    expect(moved.queue[moved.index]).toBe(queue[1]);
    expect(queue.map((item) => item.bvid)).toEqual(['A', 'B', 'C']);
    const state = { queue, index: 2 };
    expect(moveInQueue(state, 0, 99)).toBe(state);
    expect(moveInQueue(state, 0, 2).index).toBe(1);
  });
});

describe('native playback transition ordering', () => {
  test('never overlaps replacements and prevents an older completion from autoplaying', async () => {
    const transitions = createPlaybackTransitions();
    const gate = deferred();
    const calls: string[] = [];
    const first = transitions.begin();
    const firstResult = transitions.replace(first, async () => {
      calls.push('first start');
      await gate.promise;
      calls.push('first end');
    });
    await Promise.resolve();
    const second = transitions.begin();
    const secondResult = transitions.replace(second, async () => {
      calls.push('second');
    });
    expect(calls).toEqual(['first start']);
    gate.resolve();
    expect(await firstResult).toBe(false);
    expect(await secondResult).toBe(true);
    expect(calls).toEqual(['first start', 'first end', 'second']);
  });
  test('skips late API results and recovers after a native replacement fails', async () => {
    const transitions = createPlaybackTransitions();
    const stale = transitions.begin();
    const current = transitions.begin();
    let staleCalled = false;
    expect(
      await transitions.replace(stale, async () => {
        staleCalled = true;
      }),
    ).toBe(false);
    expect(staleCalled).toBe(false);
    await expect(
      transitions.replace(current, async () => {
        throw new Error('native error');
      }),
    ).rejects.toThrow('native error');
    const retry = transitions.begin();
    expect(await transitions.replace(retry, async () => {})).toBe(true);
  });
});

describe('sleep deadline policy', () => {
  test('uses absolute deadlines and respects cancellation', () => {
    expect(sleepDeadline(15, 1000)).toBe(901000);
    expect(sleepDeadline(2, 1000)).toBeUndefined();
    expect(sleepExpired(901000, 900999)).toBe(false);
    expect(sleepExpired(901000, 901000)).toBe(true);
    expect(sleepExpired(undefined, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
  test('expiry invalidates pending API work and in-flight replacement autoplay', async () => {
    const transitions = createPlaybackTransitions();
    const first = transitions.begin();
    const gate = deferred();
    const result = transitions.replace(first, () => gate.promise);
    await Promise.resolve();
    let paused = false;
    expect(
      stopForSleep(1000, 999, transitions, () => {
        paused = true;
      }),
    ).toBe(false);
    expect(transitions.isCurrent(first)).toBe(true);
    expect(
      stopForSleep(1000, 1000, transitions, () => {
        paused = true;
      }),
    ).toBe(true);
    expect(paused).toBe(true);
    gate.resolve();
    expect(await result).toBe(false);
    expect(
      await transitions.replace(first, async () => {
        throw new Error('must skip late API');
      }),
    ).toBe(false);
    const manualPlay = transitions.begin();
    expect(await transitions.replace(manualPlay, async () => {})).toBe(true);
  });
});
