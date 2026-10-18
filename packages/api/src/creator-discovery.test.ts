import { describe, expect, test } from 'bun:test';
import { normalizeSummary } from './bilibili';
import { BilibiliExtractorApi } from './extractor-api';
import type { PageResult, VideoSummary } from './types';

class FixtureApi extends BilibiliExtractorApi {
  urls: string[] = [];
  protected async request<T>(url: string): Promise<T> {
    this.urls.push(url);
    if (url.includes('/x/web-interface/card?'))
      return {
        card: {
          name: 'Creator',
          face: 'http://image/avatar',
          sign: 'About me',
          fans: 42,
        },
        space: { l_img: 'http://image/banner' },
      } as T;
    if (url.includes('get_status_info_by_uids')) return {} as T;
    return [
      {
        bvid: 'BVrelated',
        title: 'Related',
        owner: { name: 'Uploader', mid: 77 },
        pic: 'http://image/thumb',
      },
    ] as T;
  }
}

describe('creator discovery API', () => {
  test('retains creator IDs across recommendation and search normalization', () => {
    expect(
      normalizeSummary({ owner: { name: 'Owner', mid: 12 } }).uploaderId,
    ).toBe('12');
    expect(normalizeSummary({ author: 'Author', mid: 34 }).uploaderId).toBe(
      '34',
    );
    expect(normalizeSummary({ author: 'Unknown' }).uploaderId).toBeUndefined();
  });
  test('loads creator profile and normalizes related videos through established URLs', async () => {
    const api = new FixtureApi();
    expect(await api.getChannel('77')).toEqual({
      id: '77',
      name: 'Creator',
      avatar: 'https://image/avatar',
      banner: 'https://image/banner',
      description: 'About me',
      followers: 42,
      live: undefined,
    });
    const related = await api.getRelated('BV test&value');
    expect(related[0].uploaderId).toBe('77');
    expect(related[0].thumbnail).toBe('https://image/thumb');
    expect(api.urls).toContain(
      'https://api.bilibili.com/x/web-interface/archive/related?bvid=BV%20test%26value',
    );
    expect(api.urls).toContain(
      'https://api.bilibili.com/x/web-interface/card?photo=true&mid=77',
    );
  });
  test('fallback client cursor keeps its mode and passes archive ID to the next request', async () => {
    const calls: {
      page?: number;
      mode?: 'web' | 'search' | 'client';
      lastAid?: number;
    }[] = [];
    class ClientFallback extends BilibiliExtractorApi {
      async getChannelVideos(
        _mid: string,
        options: {
          page?: number;
          mode?: 'web' | 'search' | 'client';
          lastAid?: number;
        } = {},
      ): Promise<PageResult<VideoSummary>> {
        calls.push(options);
        if (options.mode !== 'client') throw new Error('blocked');
        return { items: [], next: options.lastAid === 123 ? undefined : '123' };
      }
    }
    const api = new ClientFallback();
    const first = await api.getChannelVideosWithFallback('77');
    expect(first.next).toBe('client:123');
    const second = await api.getChannelVideosWithFallback('77', first.next!);
    expect(second.next).toBeUndefined();
    expect(calls.map((call) => call.mode)).toEqual([
      'web',
      'search',
      'client',
      'client',
    ]);
    expect(calls.at(-1)?.lastAid).toBe(123);
  });
});
