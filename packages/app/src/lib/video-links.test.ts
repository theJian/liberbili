import { describe, expect, test } from 'bun:test';

import {
  canonicalVideoUrl,
  playVideoReference,
  resolveVideoLink,
} from './video-links';

describe('video sharing links', () => {
  test('shares a clean canonical video URL', () => {
    expect(canonicalVideoUrl('BV17x411w7KC')).toBe(
      'https://www.bilibili.com/video/BV17x411w7KC',
    );
    expect(() => canonicalVideoUrl('BV17x411w7KC?cookie=secret')).toThrow();
    expect(() => canonicalVideoUrl('live:123')).toThrow();
  });

  test('opens IDs and preserves linked part and time', async () => {
    expect((await resolveVideoLink('av170001')).bvid).toBe('BV17x411w7KC');
    expect(
      await resolveVideoLink(
        'https://www.bilibili.com/video/BV17x411w7KC?p=2&t=12.5',
      ),
    ).toMatchObject({ bvid: 'BV17x411w7KC', page: 2, timestamp: 12.5 });
  });

  test('rejects valid but unsupported premium and live references', async () => {
    await expect(
      resolveVideoLink('https://www.bilibili.com/bangumi/play/ep123'),
    ).rejects.toThrow('Unsupported video type');
    await expect(
      resolveVideoLink('https://live.bilibili.com/123'),
    ).rejects.toThrow('Unsupported video type');
  });
});

describe('linked video playback selection', () => {
  const video = {
    bvid: 'BV17x411w7KC',
  } as import('@liberbili/api/types').VideoSummary;
  const parts = [1, 2].map((page) => ({
    page,
    cid: page,
    duration: 120,
  })) as import('@liberbili/api/types').VideoPart[];
  test('passes the linked part and bounded position to the player, including on retry', async () => {
    const played: { page: number; position?: number }[] = [];
    const playback = {
      play: async () => {},
      playPart: async (
        _video: unknown,
        part: { page: number },
        position?: number,
      ) => {
        played.push({ page: part.page, position });
      },
    };
    await playVideoReference(
      video,
      parts,
      { page: '2', timestamp: '150' },
      playback,
    );
    await playVideoReference(
      video,
      parts,
      { page: '2', timestamp: '150' },
      playback,
    );
    expect(played).toEqual([
      { page: 2, position: 120 },
      { page: 2, position: 120 },
    ]);
  });
  test('explicit time selects the first part and zero overrides saved history', async () => {
    const played: { page: number; position?: number }[] = [];
    let defaultPlays = 0;
    const playback = {
      play: async () => {
        defaultPlays += 1;
      },
      playPart: async (
        _video: unknown,
        part: { page: number },
        position?: number,
      ) => {
        played.push({ page: part.page, position });
      },
    };
    await playVideoReference(video, parts, { timestamp: '0' }, playback);
    await playVideoReference(video, parts, { page: '2' }, playback);
    await playVideoReference(video, parts, {}, playback);
    expect(played).toEqual([
      { page: 1, position: 0 },
      { page: 2, position: undefined },
    ]);
    expect(defaultPlays).toBe(1);
  });
  test('rejects unavailable part and invalid direct route position', async () => {
    const playback = {
      play: async () => {
        throw new Error('must not load');
      },
      playPart: async () => {
        throw new Error('must not load');
      },
    };
    for (const position of [
      { page: '3' },
      { page: '0' },
      { timestamp: '-1' },
      { timestamp: 'NaN' },
    ])
      await expect(
        playVideoReference(video, parts, position, playback),
      ).rejects.toThrow('Invalid video position');
  });
});
