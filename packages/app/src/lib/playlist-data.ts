import type { VideoSummary } from '@liberbili/api/types';

export const PLAYLIST_NAME_LIMIT = 200;
export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  items: VideoSummary[];
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.length <= limit;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER;

export function playlistName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > PLAYLIST_NAME_LIMIT)
    throw new RangeError('Playlist names must contain 1–200 characters');
  return trimmed;
}

function normalizeVideo(value: unknown): VideoSummary | undefined {
  if (
    !record(value) ||
    !text(value.bvid, 256) ||
    !value.bvid.trim() ||
    !text(value.title, 4096) ||
    !value.title.trim() ||
    !text(value.thumbnail, 8192) ||
    !text(value.uploader, 1024) ||
    !nonnegative(value.aid) ||
    !nonnegative(value.duration) ||
    !nonnegative(value.views)
  )
    return undefined;
  const video: VideoSummary = {
    bvid: value.bvid,
    aid: value.aid,
    title: value.title,
    thumbnail: value.thumbnail,
    uploader: value.uploader,
    duration: value.duration,
    views: value.views,
  };
  if (text(value.uploaderAvatar, 8192))
    video.uploaderAvatar = value.uploaderAvatar;
  if (nonnegative(value.publishedAt)) video.publishedAt = value.publishedAt;
  if (typeof value.requiresMembership === 'boolean')
    video.requiresMembership = value.requiresMembership;
  if (
    value.type === 'video' ||
    value.type === 'live' ||
    value.type === 'premium'
  )
    video.type = value.type;
  return video;
}

export function normalizePlaylists(raw?: string): Playlist[] {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const ids = new Set<string>();
  return data.flatMap((value): Playlist[] => {
    if (
      !record(value) ||
      !text(value.id, 256) ||
      !value.id.trim() ||
      ids.has(value.id) ||
      typeof value.name !== 'string' ||
      !value.name.trim()
    )
      return [];
    const seen = new Set<string>();
    const items = (Array.isArray(value.items) ? value.items : []).flatMap(
      (item): VideoSummary[] => {
        const video = normalizeVideo(item);
        if (!video || seen.has(video.bvid)) return [];
        seen.add(video.bvid);
        return [video];
      },
    );
    ids.add(value.id);
    return [
      {
        id: value.id,
        name: value.name.trim().slice(0, PLAYLIST_NAME_LIMIT),
        createdAt: nonnegative(value.createdAt) ? value.createdAt : 0,
        items,
      },
    ];
  });
}

export function makePlaylist(
  name: string,
  id: string,
  createdAt: number,
): Playlist {
  return { id, name: playlistName(name), createdAt, items: [] };
}

export function renamePlaylist(
  all: Playlist[],
  id: string,
  name: string,
): Playlist[] {
  const trimmed = playlistName(name);
  return all.map((playlist) =>
    playlist.id === id ? { ...playlist, name: trimmed } : playlist,
  );
}
