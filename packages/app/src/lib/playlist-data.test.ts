import { describe, expect, test } from 'bun:test';
import type { VideoSummary } from '@liberbili/api/types';
import {
  makePlaylist,
  normalizePlaylists,
  PLAYLIST_NAME_LIMIT,
  renamePlaylist,
  type Playlist,
} from './playlist-data';
const video: VideoSummary = {
  bvid: 'BVtest',
  aid: 1,
  title: 'Video',
  thumbnail: 'https://example.com/cover.jpg',
  uploader: 'Creator',
  duration: 120.5,
  views: 30,
  uploaderAvatar: 'https://example.com/avatar.jpg',
  publishedAt: 100,
  requiresMembership: true,
  type: 'premium',
};
const playlist: Playlist = {
  id: 'stable-id',
  name: 'Playlist',
  createdAt: 10,
  items: [video],
};

describe('persisted playlists', () => {
  test('recovers invalid JSON and unsupported root shapes without throwing', () => {
    for (const raw of [
      undefined,
      '{',
      'null',
      '{}',
      '42',
      '"string"',
      '[null, {}, 42]',
    ])
      expect(normalizePlaylists(raw)).toEqual([]);
  });
  test('preserves valid legacy IDs, list order and all supported video fields', () => {
    const second = { ...playlist, id: 'second' };
    expect(normalizePlaylists(JSON.stringify([playlist, second]))).toEqual([
      playlist,
      second,
    ]);
  });
  test('recovers valid lists among corrupt records and keeps valid videos among malformed items', () => {
    const raw = [
      null,
      { ...playlist, id: '' },
      { ...playlist, name: ' ' },
      {
        ...playlist,
        items: [
          null,
          {},
          { ...video, duration: -1 },
          { ...video, views: 'many' },
          video,
        ],
      },
    ];
    expect(normalizePlaylists(JSON.stringify(raw))).toEqual([playlist]);
  });
  test('deduplicates IDs and per-list video identities without changing stable order', () => {
    const secondVideo = { ...video, bvid: 'second-video' };
    const second = { ...playlist, id: 'second', items: [video] };
    expect(
      normalizePlaylists(
        JSON.stringify([
          {
            ...playlist,
            items: [video, secondVideo, { ...video, title: 'Duplicate' }],
          },
          playlist,
          second,
        ]),
      ),
    ).toEqual([{ ...playlist, items: [video, secondVideo] }, second]);
  });
  test('retains recoverable metadata with missing items or invalid optional values', () => {
    expect(
      normalizePlaylists(
        JSON.stringify([
          { ...playlist, name: ' Playlist ', createdAt: 'bad', items: null },
        ]),
      ),
    ).toEqual([{ ...playlist, createdAt: 0, items: [] }]);
    const {
      uploaderAvatar,
      publishedAt,
      requiresMembership,
      type,
      ...required
    } = video;
    expect(
      normalizePlaylists(
        JSON.stringify([
          {
            ...playlist,
            items: [
              {
                ...video,
                uploaderAvatar: 1,
                publishedAt: -2,
                requiresMembership: 'yes',
                type: 'wrong',
              },
            ],
          },
        ]),
      )[0].items,
    ).toEqual([required]);
  });
  test('rejects unbounded fields and invalid identity types without poisoning valid entries', () => {
    const raw = [
      { ...playlist, id: 'x'.repeat(257) },
      {
        ...playlist,
        items: [
          { ...video, bvid: null },
          { ...video, title: 'x'.repeat(4097) },
          video,
        ],
      },
    ];
    expect(normalizePlaylists(JSON.stringify(raw))).toEqual([playlist]);
  });
});

describe('playlist public action helpers', () => {
  test('creates trimmed names and rejects blank or excessive names synchronously', () => {
    expect(makePlaylist('  Name  ', 'id', 123)).toEqual({
      id: 'id',
      name: 'Name',
      createdAt: 123,
      items: [],
    });
    for (const name of ['', '  \n\t', 'x'.repeat(PLAYLIST_NAME_LIMIT + 1)])
      expect(() => makePlaylist(name, 'id', 123)).toThrow(RangeError);
  });
  test('rename keeps identity/items and invalid rename cannot mutate the prior state', () => {
    const state = [playlist];
    const renamed = renamePlaylist(state, playlist.id, '  Renamed ');
    expect(renamed[0]).toEqual({ ...playlist, name: 'Renamed' });
    expect(renamed[0].items).toBe(playlist.items);
    expect(() => renamePlaylist(state, playlist.id, '  ')).toThrow(RangeError);
    expect(state).toEqual([playlist]);
    expect(renamePlaylist(state, 'missing-id', 'Name')).toEqual(state);
  });
});

test('recovers oversized legacy names by bounding the name while keeping IDs and videos', () => {
  expect(
    normalizePlaylists(
      JSON.stringify([
        { ...playlist, name: 'x'.repeat(PLAYLIST_NAME_LIMIT + 1) },
      ]),
    ),
  ).toEqual([{ ...playlist, name: 'x'.repeat(PLAYLIST_NAME_LIMIT) }]);
});
