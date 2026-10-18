import type { VideoPart, VideoSummary } from '@liberbili/api/types';

export const HISTORY_LIMIT = 200;
export type HistoryEntry = {
  video: VideoSummary;
  part: VideoPart;
  position: number;
  duration: number;
  watchedAt: number;
  completed: boolean;
};
export type HistoryState = { paused: boolean; entries: HistoryEntry[] };
export const historyKey = (entry: HistoryEntry): string =>
  `${entry.video.bvid}:${entry.part.cid}`;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function normalizeHistory(raw?: string): HistoryState {
  const empty = { paused: false, entries: [] };
  try {
    const data = JSON.parse(raw ?? '{}');
    if (!data || !Array.isArray(data.entries)) return empty;
    const seen = new Set<string>();
    const entries = data.entries
      .filter((entry: HistoryEntry) => {
        const video = entry?.video;
        const part = entry?.part;
        return (
          video &&
          typeof video.bvid === 'string' &&
          video.bvid.length > 0 &&
          typeof video.title === 'string' &&
          typeof video.thumbnail === 'string' &&
          typeof video.uploader === 'string' &&
          finite(video.aid) &&
          finite(video.duration) &&
          finite(video.views) &&
          part &&
          part.bvid === video.bvid &&
          finite(part.cid) &&
          part.cid > 0 &&
          finite(part.aid) &&
          finite(part.page) &&
          typeof part.title === 'string' &&
          finite(part.duration) &&
          finite(entry.position) &&
          finite(entry.duration) &&
          finite(entry.watchedAt) &&
          typeof entry.completed === 'boolean'
        );
      })
      .sort((a: HistoryEntry, b: HistoryEntry) => b.watchedAt - a.watchedAt)
      .filter((entry: HistoryEntry) => {
        const key = historyKey(entry);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, HISTORY_LIMIT)
      .map((entry: HistoryEntry) => ({
        ...entry,
        position:
          entry.duration > 0
            ? Math.min(entry.position, entry.duration)
            : entry.position,
      }));
    return { paused: data.paused === true, entries };
  } catch {
    return empty;
  }
}

export function resumePosition(
  entry: HistoryEntry | undefined,
  duration: number,
): number {
  if (
    !entry ||
    entry.completed ||
    !finite(duration) ||
    duration <= 0 ||
    entry.position < 5 ||
    entry.position >= duration - Math.min(10, duration * 0.05)
  )
    return 0;
  return entry.position;
}

export function selectHistoryPart(
  parts: VideoPart[],
  entries: HistoryEntry[],
  bvid: string,
  requested?: VideoPart,
): VideoPart | undefined {
  if (requested) return parts.find((part) => part.cid === requested.cid);
  const latest = entries.find((entry) => entry.video.bvid === bvid);
  return parts.find((part) => part.cid === latest?.part.cid) ?? parts[0];
}

export function recordHistory(
  state: HistoryState,
  entry: HistoryEntry,
): HistoryState {
  if (state.paused) return state;
  return {
    ...state,
    entries: [
      entry,
      ...state.entries.filter((item) => historyKey(item) !== historyKey(entry)),
    ].slice(0, HISTORY_LIMIT),
  };
}
