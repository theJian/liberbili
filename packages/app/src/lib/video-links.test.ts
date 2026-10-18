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

describe('linked video playback ownership', () => {
  const video = {
    bvid: 'BV17x411w7KC',
  } as import('@liberbili/api/types').VideoSummary;
  const parts = [1, 2].map((page) => ({
    page,
    cid: page,
    duration: 120,
  })) as import('@liberbili/api/types').VideoPart[];
  test('plays selected part, clamps time, and preserves position on retry', async () => {
    const played: number[] = [];
    const sought: number[] = [];
    const playback = {
      play: async () => {},
      playPart: async (_video: unknown, part: { page: number }) => {
        played.push(part.page);
      },
      isCurrent: () => true,
      seek: (seconds: number) => {
        sought.push(seconds);
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
    expect(played).toEqual([2, 2]);
    expect(sought).toEqual([120, 120]);
  });
  test('does not seek after another route or same-video part selection takes ownership', async () => {
    let finish!: () => void;
    let current = true;
    const sought: number[] = [];
    const pending = playVideoReference(
      video,
      parts,
      { page: '2', timestamp: '42' },
      {
        play: async () => {},
        playPart: () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        isCurrent: () => current,
        seek: (seconds) => {
          sought.push(seconds);
        },
      },
    );
    current = false;
    finish();
    await pending;
    expect(sought).toEqual([]);
  });
  test('rejects unavailable part and invalid direct route position', async () => {
    const playback = {
      play: async () => {
        throw new Error('must not load');
      },
      playPart: async () => {
        throw new Error('must not load');
      },
      isCurrent: () => true,
      seek: () => {},
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
