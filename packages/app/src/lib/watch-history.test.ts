import { describe, expect, test } from 'bun:test';
import {
  HISTORY_LIMIT,
  historyKey,
  normalizeHistory,
  recordHistory,
  resumePosition,
  selectHistoryPart,
  type HistoryEntry,
} from './watch-history';

const entry = (cid = 1, watchedAt = 100): HistoryEntry => ({
  video: {
    bvid: 'BVtest',
    aid: 1,
    title: 'Video',
    thumbnail: '',
    uploader: 'Creator',
    duration: 100,
    views: 0,
  },
  part: {
    bvid: 'BVtest',
    aid: 1,
    cid,
    page: cid,
    title: `Part ${cid}`,
    duration: 100,
  },
  position: 40,
  duration: 100,
  watchedAt,
  completed: false,
});

describe('watch history persistence', () => {
  test('recovers from corrupt or unsupported storage', () => {
    for (const raw of [
      undefined,
      '{',
      'null',
      '[]',
      '{}',
      '{"entries":[null,{},42]}',
    ])
      expect(normalizeHistory(raw)).toEqual({ paused: false, entries: [] });
  });
  test('validates identity and finite progress before accepting persisted records', () => {
    const invalid = [
      null,
      { ...entry(), position: -2 },
      { ...entry(), video: {} },
      { ...entry(), part: { ...entry().part, bvid: 'other' } },
    ];
    expect(
      normalizeHistory(JSON.stringify({ entries: [...invalid, entry()] }))
        .entries,
    ).toEqual([entry()]);
  });
  test('retains latest per-part record, clamps progress, and bounds persisted history', () => {
    const entries = Array.from({ length: HISTORY_LIMIT + 20 }, (_, index) =>
      entry(index + 1, index),
    );
    const normalized = normalizeHistory(
      JSON.stringify({ paused: true, entries: [entry(1, 1000), ...entries] }),
    );
    expect(normalized.paused).toBe(true);
    expect(normalized.entries).toHaveLength(HISTORY_LIMIT);
    expect(normalized.entries[0]).toEqual(entry(1, 1000));
    expect(
      normalizeHistory(
        JSON.stringify({ entries: [{ ...entry(), position: 900 }] }),
      ).entries[0].position,
    ).toBe(100);
  });
  test('updates a part without collapsing other parts and honors pause', () => {
    const state = { paused: false, entries: [entry(1), entry(2)] };
    expect(recordHistory(state, entry(1, 200)).entries.map(historyKey)).toEqual(
      ['BVtest:1', 'BVtest:2'],
    );
    const paused = { ...state, paused: true };
    expect(recordHistory(paused, entry(3))).toBe(paused);
  });
});

describe('resume decisions', () => {
  test('resumes only meaningful unfinished progress inside the current duration', () => {
    expect(resumePosition(entry(), 100)).toBe(40);
    for (const value of [
      { ...entry(), completed: true },
      { ...entry(), position: 2 },
      { ...entry(), position: 99 },
    ])
      expect(resumePosition(value, 100)).toBe(0);
    expect(resumePosition(entry(), 30)).toBe(0);
    expect(resumePosition(entry(), 0)).toBe(0);
    expect(resumePosition(undefined, 100)).toBe(0);
  });
  test('explicit parts win; deleted parts fall back safely only for default playback', () => {
    const parts = [entry(1).part, entry(2).part];
    expect(selectHistoryPart(parts, [entry(2)], 'BVtest')?.cid).toBe(2);
    expect(selectHistoryPart(parts, [entry(2)], 'BVtest', parts[0])?.cid).toBe(
      1,
    );
    expect(selectHistoryPart(parts, [entry(3)], 'BVtest')?.cid).toBe(1);
    expect(
      selectHistoryPart(parts, [], 'BVtest', entry(3).part),
    ).toBeUndefined();
    expect(selectHistoryPart([], [], 'BVtest')).toBeUndefined();
  });
});
