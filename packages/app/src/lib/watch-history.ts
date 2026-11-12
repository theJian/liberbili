/**
 * Models local watch history by video part and keeps persisted records safe to use.
 * The history provider calls normalizeHistory on stored JSON at startup and
 * recordHistory to update the bounded list. Playback uses selectHistoryPart to choose
 * a part and resumePosition to decide whether its saved progress is worth seeking.
 * Progress and durations are in seconds; watchedAt is a Unix timestamp in milliseconds.
 */
import type { VideoPart, VideoSummary } from '@liberbili/api/types';

export const HISTORY_LIMIT = 200;
/** One saved playback position for a video part, identified by bvid and cid. */
export type HistoryEntry = {
  video: VideoSummary;
  part: VideoPart;
  position: number;
  duration: number;
  watchedAt: number;
  completed: boolean;
};
export type HistoryState = { paused: boolean; entries: HistoryEntry[] };
/** Returns the stable video-part identity used for replacement and removal. */
export const historyKey = (entry: HistoryEntry): string =>
  `${entry.video.bvid}:${entry.part.cid}`;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Reads stored JSON, discarding invalid records and retaining the latest record
 * per part, up to HISTORY_LIMIT. Invalid storage yields an unpaused empty history.
 * Positions beyond a known positive duration are clamped to that duration.
 */
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

/**
 * Returns the saved position in seconds, or 0 to start over. Completed entries,
 * progress before 5 seconds, and progress at or beyond the start of the final
 * min(10 seconds, 5% of duration) do not resume. A nonpositive or nonfinite
 * supplied duration also returns 0.
 */
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

/**
 * Selects an explicitly requested part if it still exists. Otherwise uses the
 * first history entry for the video, falling back to the first available part.
 * An unavailable explicit request or an empty parts list returns undefined.
 */
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

/**
 * Replaces a part's record at the front of the bounded list. When history is
 * paused, returns the original state without recording the entry.
 */
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
