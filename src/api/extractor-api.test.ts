import { describe, expect, test } from 'bun:test';

import { BilibiliExtractorApi } from './extractor-api';

const api = new BilibiliExtractorApi();

describe('PipePipe Bilibili URL parity', () => {
  test('resolves BV links with part and timestamp', async () => {
    await expect(api.resolveStreamUrl('https://www.bilibili.com/video/BV1xx411c7mD?p=3&t=42')).resolves.toEqual({
      kind: 'video', id: 'BV1xx411c7mD?p=3#timestamp=42', bvid: 'BV1xx411c7mD', page: 3, timestamp: 42,
    });
  });

  test('resolves AV, premium, and live links', async () => {
    const av = await api.resolveStreamUrl('https://www.bilibili.com/video/av170001');
    expect(av.kind).toBe('video');
    if (av.kind === 'video') expect(av.bvid).toBe('BV17x411w7KC');
    await expect(api.resolveStreamUrl('https://www.bilibili.com/bangumi/play/ep123')).resolves.toEqual({ kind: 'premium', id: 'ep123' });
    await expect(api.resolveStreamUrl('https://live.bilibili.com/456')).resolves.toEqual({ kind: 'live', id: '456' });
  });
});

