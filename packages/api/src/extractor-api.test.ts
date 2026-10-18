import { describe, expect, test } from 'bun:test';

import {
  audioQualityLabel,
  BilibiliExtractorApi,
  isBilibiliMediaUrl,
  isBilibiliUrl,
  videoQualityLabel,
} from './extractor-api';

const api = new BilibiliExtractorApi();

describe('PipePipe Bilibili URL parity', () => {
  test('resolves BV links with part and timestamp', async () => {
    await expect(
      api.resolveStreamUrl(
        'https://www.bilibili.com/video/BV1xx411c7mD?p=3&t=42',
      ),
    ).resolves.toEqual({
      kind: 'video',
      id: 'BV1xx411c7mD?p=3#timestamp=42',
      bvid: 'BV1xx411c7mD',
      page: 3,
      timestamp: 42,
    });
  });

  test('resolves AV, premium, and live links', async () => {
    const av = await api.resolveStreamUrl(
      'https://www.bilibili.com/video/av170001',
    );
    expect(av.kind).toBe('video');
    if (av.kind === 'video') expect(av.bvid).toBe('BV17x411w7KC');
    await expect(
      api.resolveStreamUrl('https://www.bilibili.com/bangumi/play/ep123'),
    ).resolves.toEqual({ kind: 'premium', id: 'ep123' });
    await expect(
      api.resolveStreamUrl('https://live.bilibili.com/456'),
    ).resolves.toEqual({ kind: 'live', id: '456' });
  });
});

describe('PipePipe Bilibili service utility parity', () => {
  test('recognizes Bilibili pages and media CDN URLs without accepting lookalikes', () => {
    expect(isBilibiliUrl('https://space.bilibili.com/1')).toBe(true);
    expect(
      isBilibiliUrl('https://bilibili.com.evil.example/video/BV1xx411c7mD'),
    ).toBe(false);
    expect(isBilibiliUrl('not a url')).toBe(false);
    expect(
      isBilibiliMediaUrl('https://upos-sz-mirrorcos.bilivideo.com/file.mp4'),
    ).toBe(true);
    expect(isBilibiliMediaUrl('https://example.com/file.mp4')).toBe(false);
  });

  test('maps every special quality family exposed by PipePipe', () => {
    expect(videoQualityLabel(127)).toBe('8K');
    expect(videoQualityLabel(126)).toBe('Dolby Vision');
    expect(videoQualityLabel(999)).toBe('Unknown resolution');
    expect(audioQualityLabel(30251)).toBe('Hi-Res lossless');
    expect(audioQualityLabel(999)).toBe('Unknown bitrate');
  });
});

describe('Bilibili link input validation', () => {
  test('accepts trimmed bare IDs and mobile links', async () => {
    expect(await api.resolveStreamUrl('  BV17x411w7KC  ')).toMatchObject({
      kind: 'video',
      bvid: 'BV17x411w7KC',
      page: 1,
    });
    expect(await api.resolveStreamUrl('av170001')).toMatchObject({
      bvid: 'BV17x411w7KC',
    });
    expect(
      await api.resolveStreamUrl('https://m.bilibili.com/video/BV17x411w7KC/'),
    ).toMatchObject({ bvid: 'BV17x411w7KC' });
  });

  test('rejects unrelated hosts, credentials, malformed identifiers and positions', async () => {
    for (const input of [
      'https://example.com/video/BV17x411w7KC',
      'https://bilibili.com.evil.example/video/BV17x411w7KC',
      'https://www.bilibili.com@evil.example/video/BV17x411w7KC',
      'https://user:pass@www.bilibili.com/video/BV17x411w7KC',
      'https://www.bilibili.com:8443/video/BV17x411w7KC',
      'file:///video/BV17x411w7KC',
      'https://www.bilibili.com/video/BV17x411w7KC_extra',
      'https://www.bilibili.com/video/BV0000000000',
      'https://www.bilibili.com/video/av0',
      'https://www.bilibili.com/video/av9007199254740993',
      'https://www.bilibili.com/video/BV17x411w7KC?p=0',
      'https://www.bilibili.com/video/BV17x411w7KC?p=1.5',
      'https://www.bilibili.com/video/BV17x411w7KC?t=-5',
      'https://www.bilibili.com/video/BV17x411w7KC?t=Infinity',
      'https://www.bilibili.com/video/BV17x411w7KC?p=NaN',
      'BV17x411w7KC more text',
      'not a URL',
    ])
      await expect(api.resolveStreamUrl(input)).rejects.toThrow();
  });

  test('resolves b23 redirects and validates redirect destinations', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(null, {
        status: 302,
        headers: {
          location: 'https://www.bilibili.com/video/BV17x411w7KC?p=2',
        },
      });
    }) as unknown as typeof fetch;
    try {
      expect(await api.resolveStreamUrl('https://b23.tv/abc123')).toMatchObject(
        { bvid: 'BV17x411w7KC', page: 2 },
      );
      expect(calls).toBe(1);
      globalThis.fetch = (async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/video/BV17x411w7KC' },
        })) as unknown as typeof fetch;
      await expect(
        api.resolveStreamUrl('https://b23.tv/abc123'),
      ).rejects.toThrow('Not a supported Bilibili URL');
      globalThis.fetch = (async () =>
        new Response(null, { status: 503 })) as unknown as typeof fetch;
      await expect(
        api.resolveStreamUrl('https://b23.tv/abc123'),
      ).rejects.toThrow();
      globalThis.fetch = (async () =>
        new Response(null, {
          status: 302,
          headers: { location: '/another' },
        })) as unknown as typeof fetch;
      await expect(
        api.resolveStreamUrl('https://b23.tv/abc123'),
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = original;
    }
  });
});
