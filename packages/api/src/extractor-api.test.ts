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
